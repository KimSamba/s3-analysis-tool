import {S3} from 'aws-sdk';
import {Subject, Observable, from, iif} from 'rxjs';
import {
  map,
  mergeAll,
  mergeMap,
  toArray,
  reduce,
  groupBy,
  filter,
} from 'rxjs/operators';

interface BucketDetailedInfo {
  Size: number;
  LastModified: Date;
  NumberOfFiles: number;
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
      NumberOfFiles: 0,
      Size: 0,
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
    filter?: string;
  }): Observable<BucketBasicInfo> {
    const obs$ = from(this.s3.listBuckets().promise()).pipe(
      map(x => x.Buckets!),
      mergeAll(),
      filter(x => params?.filter === undefined || x.Name!.includes(params?.filter)),
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
        mergeAll(),
      ),
      obs$
    );
  }

  getBucketInfoV2(Bucket: string): Observable<BucketDetailedInfo> {
    // list all common prefixes from bucket
    return this.getCommonPrefixes(Bucket).pipe(
      mergeMap(Prefix =>
        this.listObjects({
          Bucket,
          Prefix,
        })
      ),
      map(this.computeListObjectInfo),
      reduce(this.accumulateBucketInfo, S3Service.initInfo())
    );
  }

  accumulateBucketInfo(
    info1: BucketDetailedInfo,
    info2: BucketDetailedInfo
  ): BucketDetailedInfo {
    return {
      LastModified: new Date(
        Math.max(info1.LastModified.valueOf(), info2.LastModified.valueOf())
      ),
      NumberOfFiles: info1.NumberOfFiles + info2.NumberOfFiles,
      Size: info1.Size + info2.Size,
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

  computeListObjectInfo(input: S3.ListObjectsV2Output): BucketDetailedInfo {
    const bucketInfo: BucketDetailedInfo = input.Contents!.reduce(
      (acc, val) => {
        return {
          LastModified: new Date(
            Math.max(acc.LastModified.valueOf(), val.LastModified!.valueOf())
          ),
          NumberOfFiles: acc.NumberOfFiles + 1,
          Size: acc.Size + (val.Size || 0),
        };
      },
      S3Service.initInfo()
    );

    return bucketInfo;
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
