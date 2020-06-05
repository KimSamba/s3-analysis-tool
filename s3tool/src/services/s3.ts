import {S3} from 'aws-sdk';
import {} from 'rxjs';

interface BucketInfo {
  Size: number;
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

  async getBucketInfo(Bucket: string): Promise<BucketInfo> {
    async function* listObjects(s3: S3) {
      let Marker: string = '';
      let IsTruncated: boolean = false;
      do {
        const list = await s3
          .listObjects({
            Bucket,
            ...(!!Marker && {Marker}),
          })
          .promise();

        IsTruncated = list.IsTruncated!;
        const NewMarker = list.Contents?.[list.Contents.length - 1]?.Key;

        if (NewMarker) {
          Marker = NewMarker;
        }

        yield list;
      } while (IsTruncated);
    }

    let info: BucketInfo = {
      NumberOfFiles: 0,
      Size: 0
    }
    for await(const objects of listObjects(this.s3)) {
      info.Size += objects.Contents?.reduce((prev, cur) => prev + cur.Size!, 0) || 0;
      info.NumberOfFiles += objects.Contents?.length || 0;
    };

    return info;
  }
}
