import {S3} from 'aws-sdk';
import {Subject, Observable, from} from 'rxjs';
import {
  map,
  mergeAll,
  mergeMap,
  scan,
} from 'rxjs/operators';

interface BucketInfo {
  Size: number;
  LastModified: Date;
  NumberOfFiles: number;
}

export class S3Service {
  private static instance: S3Service;
  private s3: S3;

  private constructor() {
    this.s3 = new S3();
  }

  static getInstance(): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service();
    }

    return S3Service.instance;
  }

  async listBuckets() {
    const {Buckets} = await this.s3.listBuckets().promise();
    return Buckets || [];
  }

  async getBucketInfoV2(Bucket: string) {
    // list all common prefixes from bucket
    return this.getCommonPrefixes(Bucket).pipe(
      mergeMap(Prefix =>
        this.listObjects({
          Bucket,
          Prefix,
        })
      ),
      map(this.computeListObjectInfo),
      scan(this.accumulateBucketInfo)
    );
  }

  accumulateBucketInfo(info1: BucketInfo, info2: BucketInfo) {
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

  computeListObjectInfo(input: S3.ListObjectsV2Output): BucketInfo {
    const bucketInfo: BucketInfo = input.Contents!.reduce(
      (acc, val) => {
        return {
          LastModified: new Date(
            Math.max(acc.LastModified.valueOf(), val.LastModified!.valueOf())
          ),
          NumberOfFiles: acc.NumberOfFiles + 1,
          Size: acc.Size + (val.Size || 0),
        };
      },
      {
        LastModified: new Date(0),
        NumberOfFiles: 0,
        Size: 0,
      } as BucketInfo
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
