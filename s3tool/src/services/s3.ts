import {S3} from 'aws-sdk';
import {Subject, Observable, from, iif, zip} from 'rxjs';
import {
  map,
  mergeAll,
  mergeMap,
  toArray,
  reduce,
  groupBy,
  filter,
  tap,
  withLatestFrom,
} from 'rxjs/operators';

export type StorageTypeList = {
  [type in Partial<S3.StorageClass>]: StorageContent;
};

export interface StorageContent {
  Size: number;
  NumberOfFiles: number;
}

interface BucketDetailedInfo {
  StorageClassList: StorageTypeList;
  LastModified: Date;
}

type BucketBasicInfo = S3.Bucket & {
  Region: string;
};

type BucketFullInfo = BucketBasicInfo & BucketDetailedInfo;

export class S3Service {
  private static instance: S3Service;
  private s3: S3;

  private constructor() {
    this.s3 = new S3();
  }

  static initInfo(): BucketDetailedInfo {
    return {
      LastModified: new Date(0),
      StorageClassList: {},
    };
  }

  static getInstance(): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service();
    }

    return S3Service.instance;
  }

  listBuckets(params?: {
    groupByRegion?: string;
    name?: string;
  }): Observable<BucketBasicInfo> {
    const obs$ = from(this.s3.listBuckets().promise()).pipe(
      map(x => x.Buckets!),
      mergeAll(),
      filter(x => params?.name === undefined || x.Name!.includes(params?.name)),
      mergeMap(async x => {
        const {LocationConstraint} = await this.s3
          .getBucketLocation({Bucket: x.Name!})
          .promise();

        return {
          ...x,
          Region: LocationConstraint || 'us-east-1',
        };
      })
    );

    return iif(
      () => !!params?.groupByRegion,
      obs$.pipe(
        groupBy(x => x.Region),
        mergeMap(group => group.pipe(toArray())),
        mergeAll()
      ),
      obs$
    );
  }

  getBucketInfo(Bucket: string, options?: {
    storageClass?: string;
  }): Observable<BucketDetailedInfo> {
    // list all common prefixes from bucket
    return this.getCommonPrefixes(Bucket).pipe(
      mergeMap(Prefix =>
        this.listObjects({
          Bucket,
          Prefix,
        })
      ),
      mergeMap(x => this.computeListObjectInfo(x, options)),
      filter(x => !!x),
      reduce(this.accumulateBucketInfo, S3Service.initInfo())
    );
  }

  getTotalBucketSize(params: {
    storageTypeList: StorageTypeList;
    filterByStorageClass?: S3.StorageClass;
  }): StorageContent {
    const val = Object.entries(params.storageTypeList)
      .filter(
        ([storageClass]) =>
          !params.filterByStorageClass ||
          storageClass === params.filterByStorageClass
      )
      .map(([_, val]) => val)
      .reduce(
        (acc, val) => {
          return {
            NumberOfFiles: acc.NumberOfFiles + val.NumberOfFiles,
            Size: acc.Size + val.Size,
          };
        },
        {
          NumberOfFiles: 0,
          Size: 0,
        }
      );
    return val;
  }

  accumulateBucketInfo(
    info1: BucketDetailedInfo,
    info2: BucketDetailedInfo
  ): BucketDetailedInfo {
    const sumStorageType: StorageTypeList = {};

    [info1, info2]
      .map(x => Object.entries(x.StorageClassList))
      .forEach(entries => {
        for (const [key, value] of entries) {
          if (sumStorageType[key]) {
            const {NumberOfFiles, Size} = sumStorageType[key];
            sumStorageType[key] = {
              NumberOfFiles: NumberOfFiles + value.NumberOfFiles,
              Size: Size + value.Size,
            };
          } else {
            sumStorageType[key] = value;
          }
        }
      });
    return {
      LastModified: new Date(
        Math.max(info1.LastModified.valueOf(), info2.LastModified.valueOf())
      ),
      StorageClassList: sumStorageType,
    };
  }

  getCommonPrefixes(Bucket: string): Observable<string> {
    return this.listObjects({
      Bucket,
      Delimiter: '/',
    }).pipe(
      map(x => x.CommonPrefixes!.map(el => el.Prefix!)),
      mergeAll()
    );
  }

  computeListObjectInfo(
    input: S3.ListObjectsV2Output,
    options?: {
      storageClass?: S3.StorageClass;
    }
  ): Promise<BucketDetailedInfo> {
    const content$ = from(input.Contents!).pipe(
      filter(
        x => !options?.storageClass || x.StorageClass === options.storageClass
      )
    );

    const lastModified$ = content$.pipe(
      reduce(
        (acc, val) => {
          return {
            LastModified: new Date(
              Math.max(acc.LastModified!.valueOf(), val.LastModified!.valueOf())
            ),
          };
        },
        {LastModified: new Date(0)}
      )
    );

    const storageClassContent$ = content$.pipe(
      groupBy(x => x.StorageClass),
      mergeMap(group =>
        group.pipe(
          reduce(
            (acc, val) => {
              return {
                NumberOfFiles: acc.NumberOfFiles + 1,
                Size: acc.Size + val.Size!,
              };
            },
            {
              NumberOfFiles: 0,
              Size: 0,
            }
          ),
          map(x => {
            return {
              [group.key!]: x,
            };
          })
        )
      ),
      reduce((acc, val) => {
        return {
          ...acc,
          ...val,
        };
      }),
      map(x => ({StorageClassList: x}))
    );

    return zip(lastModified$, storageClassContent$)
      .pipe(
        map(([lastModified, storageClassContent]) => ({
          ...lastModified,
          ...storageClassContent,
        }))
      )
      .toPromise();
  }

  listObjects(params: {
    Bucket: string;
    Prefix?: string;
    Delimiter?: string;
  }): Observable<S3.ListObjectsV2Output> {
    const {Bucket, Delimiter, Prefix} = params;

    async function* listObjectGenerator(s3: S3) {
      let ContinuationToken: string = '';
      let IsTruncated: boolean = false;
      do {
        const list = await s3
          .listObjectsV2({
            Bucket,
            ...(!!Delimiter && {Delimiter}),
            ...(!!Prefix && {Prefix}),

            ...(!!ContinuationToken && {ContinuationToken}),
          })
          .promise();

        IsTruncated = list.IsTruncated!;
        ContinuationToken = list.NextContinuationToken!;

        yield list;
      } while (IsTruncated);
    }

    const subject$: Subject<S3.ListObjectsV2Output> = new Subject();

    (async () => {
      for await (const objects of listObjectGenerator(this.s3)) {
        subject$.next(objects);
      }
      subject$.complete();
    })();

    return from(subject$);
  }
}
