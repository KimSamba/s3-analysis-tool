s3tool
======



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/s3tool.svg)](https://npmjs.org/package/s3tool)
[![Downloads/week](https://img.shields.io/npm/dw/s3tool.svg)](https://npmjs.org/package/s3tool)
[![License](https://img.shields.io/npm/l/s3tool.svg)](https://github.com/KimSamba/s3-analysis-tool/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g s3tool
$ s3tool COMMAND
running command...
$ s3tool (-v|--version|version)
s3tool/0.0.0 linux-x64 node-v12.12.0
$ s3tool --help [COMMAND]
USAGE
  $ s3tool COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`s3tool hello [FILE]`](#s3tool-hello-file)
* [`s3tool help [COMMAND]`](#s3tool-help-command)

## `s3tool hello [FILE]`

describe the command here

```
USAGE
  $ s3tool hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ s3tool hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/KimSamba/s3-analysis-tool/blob/v0.0.0/src/commands/hello.ts)_

## `s3tool help [COMMAND]`

display help for s3tool

```
USAGE
  $ s3tool help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_
<!-- commandsstop -->
