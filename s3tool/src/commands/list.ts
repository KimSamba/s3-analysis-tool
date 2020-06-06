import {Command, flags} from '@oclif/command';
import {S3Service} from '../services/s3';
import {
  mostRelevantUnit,
  prefixWithUnit,
  unitVal,
  SizeUnit,
} from '../util/unitPrefix';

export default class list extends Command {
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
      parse: input => input.toUpperCase()
    }),
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  };

  static args = [];

  async run() {
    const {args, flags} = this.parse(list);

    const buckets = await list.s3Service.listBuckets();

    Promise.all(
      buckets.map(async bucket => {
        const {Name, CreationDate} = bucket;
        const {LastModified, NumberOfFiles, Size} = await (
          await list.s3Service.getBucketInfoV2(Name!)
        ).toPromise();

        this.log(`
Name: \t ${Name}
Creation Date: \t ${CreationDate}
Last Modified: \t ${LastModified}
Number of files: \t ${NumberOfFiles}
Total size: \t ${
          flags.unit
            ? prefixWithUnit(Size, flags.unit as SizeUnit)
            : mostRelevantUnit(Size)
        }
`);
      })
    );
  }
}
