import {Command, flags} from '@oclif/command';
import {S3Service, StorageTypeList, StorageContent} from '../services/s3';
import {mostRelevantUnit, prefixWithUnit, SizeUnit} from '../util/unitPrefix';
import {mergeMap, map, defaultIfEmpty} from 'rxjs/operators';
import {S3} from 'aws-sdk';
import {option} from '@oclif/command/lib/flags';

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
    'group-by': flags.string({
      char: 'g',
      description: 'group by a specific value',
      options: ['region'],
    }),
    help: flags.help({char: 'h'}),
    name: flags.string({char: 'n', description: 'filter by bucket name'}),
    'storage-class': flags.string({
      char: 's',
      description: 'filter by specific storage class',
      options: [
        'STANDARD',
        'REDUCED_REDUNDANCY',
        'STANDARD_IA',
        'ONEZONE_IA',
        'INTELLIGENT_TIERING',
        'GLACIER',
        'DEEP_ARCHIVE',
      ],
    }),
  };

  static args = [];

  async run() {
    const {args, flags} = this.parse(List);

    List.s3Service
      .listBuckets({
        groupByRegion: flags['group-by'],
        name: flags.name,
      })
      .pipe(
        mergeMap(bucket => {
          return List.s3Service
            .getBucketInfo(bucket.Name!, {
              storageClass: flags['storage-class'],
            })
            .pipe(
              map(x => ({
                ...x,
                ...bucket,
              }))
            );
        })
      )
      .subscribe(bucket => {
        const totalSize = S3Service.getInstance().getTotalBucketSize({
          storageTypeList: bucket.StorageClassList,
        });
        this.log(`
==================================
Name: \t ${bucket.Name}
Region: \t ${bucket.Region}
Creation Date: \t ${bucket.CreationDate}
Last Modified: \t ${bucket.LastModified}
${flags['storage-class'] ? flags['storage-class'] : 'Total'} size:
  Nb of Files: \t ${totalSize.NumberOfFiles}
  Size: \t ${
    flags.unit
      ? prefixWithUnit(totalSize.Size, flags.unit as SizeUnit)
      : mostRelevantUnit(totalSize.Size)
  }

${
  (!flags['storage-class'] &&
    totalSize.Size > 0 &&
    `Stats by class:
${this.displayStatsStorageClasses(bucket.StorageClassList, totalSize)}`) ||
  ''
}`);
      });
  }

  displayStatsStorageClasses(
    list: StorageTypeList,
    total: StorageContent,
    unit?: string
  ) {
    function displayClassContent(val: StorageContent) {
      return `
    Percentage: \t ${((val.Size / total.Size) * 100).toFixed(2)}%
    Nb of Files: \t ${val.NumberOfFiles}
    Size: \t ${
      unit
        ? prefixWithUnit(val.Size, unit as SizeUnit)
        : mostRelevantUnit(val.Size)
    }`;
    }
    return Object.entries(list)
      .map(([storageClass, val]) => {
        return `
  ${storageClass}:${displayClassContent(val)}
`;
      })
      .join('');
  }
}
