import {S3} from 'aws-sdk';

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
    const { Buckets } = await this.s3.listBuckets().promise();
    return Buckets || [];
  }
}
