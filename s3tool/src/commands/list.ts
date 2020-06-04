import {Command, flags} from '@oclif/command'
import { S3Service } from '../services/s3'

export default class list extends Command {
  static description = 'Lists the buckets in the current AWS account'

  static examples = [
    `$ s3tool list
bucket1
bucket2
bucket3
`,
  ]

  static s3Service = S3Service.getInstance();

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  }

  static args = []

  async run() {
    const {args, flags} = this.parse(list)

    const buckets = await list.s3Service.listBuckets();
    for (const bucket of buckets) {
      this.log(bucket.Name);
    }
  }
}
