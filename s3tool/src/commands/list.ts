import {Command, flags} from '@oclif/command';
import {S3Service} from '../services/s3';
import {mostRelevantUnit, prefixWithUnit, SizeUnit} from '../util/unitPrefix';
import {mergeMap, map, defaultIfEmpty} from 'rxjs/operators';

export default class List extends Command {
  static description = 'Lists the buckets in the current AWS account';

  static examples = [
    `$ s3tool list
bucket1
bucket2
bucket3
`,
  ];

  static s3Service = S3Service.getInstance();

  static flags = {
    unit: flags.string({
      char: 'u',
      description: 'unit for the size',
      options: Object.values(SizeUnit).map(x => x.toLowerCase()),
      parse: input => input.toUpperCase(),
    }),
    groupBy: flags.string({
      char: 'g',
      description: 'group by a specific value',
      options: ['region'],
    }),
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    filter: flags.string({char: 'f', description: 'filter by bucket name'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  };

  static args = [];

  async run() {
    const {args, flags} = this.parse(List);

    List.s3Service
      .listBuckets({
        groupByRegion: flags.groupBy,
        filter: flags.filter,
      })
      .pipe(
        mergeMap(bucket => {
          return List.s3Service.getBucketInfoV2(bucket.Name!).pipe(
            map(x => ({
              ...x,
              ...bucket,
            }))
          );
        })
      )
      .subscribe(bucket => {
        this.log(`
Name: \t ${bucket.Name}
Region: \t ${bucket.Region}
Creation Date: \t ${bucket.CreationDate}
Last Modified: \t ${bucket.LastModified}
Number of files: \t ${bucket.NumberOfFiles}
Total size: \t ${
          flags.unit
            ? prefixWithUnit(bucket.Size, flags.unit as SizeUnit)
            : mostRelevantUnit(bucket.Size)
        }
`);
      });
  }
}
