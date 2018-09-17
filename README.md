# GenJSON

> A simple CLI used to produce a JSON stream with fake data using JSON schema.

This is basically a CLI upon [json-schema-faker][json-schema-faker] project.

## Install

```bash
npm install -g genjson
```

## Configuration

The JSON generation is based on a [JSON-Schema][json-schema] (draft-04).

You can add an `x-faker` attribute to choose the data to be generated.

**Example:**

```json
{
  "id": "Sample",
  "type": "object",
  "properties": {
    "uuid": {"type": "string", "x-faker": "random.uuid"},
    "timestamp": {"type": "integer", "x-faker": "timestamp.now"},
    "email": {"type": "string", "x-faker": "internet.email"}
  }
}
```

This will generate this kind of result:

```json
{
  "uuid": "632ff1b6-4d5e-435d-a664-5d4185a6c78e",
  "timestamp": 1537174965817,
  "email": "Julianne61@yahoo.com"}
}
```

Please refer to `faker.js` [documentation][faker.js] to see available methods.

There is also some builtin generators:

- `"x-faker": {"custom.val": "hello world"}`: A parameterized faker used to set
  a constant value.
- `"x-faker": "timestamp.now"`: Set current time using timestamp format.
- `"x-faker": "timestamp.iso"`: Set current time using ISO format.
- `"x-faker": "timestamp.recent"`: Set a timestamp from the recent past.
- `"x-faker": "timestamp.future"`: Set a timestamp form the future.

You can add you own generators (see [extensions](#Extensions) section).

## Usage

Type `genjson` to see usage.

### Example 1

```bash
$ genjson -c 10 -i 100 -o file://test.log -s ./schemas/sample.json
```

- Generates:
  - 10 JSON objects: `-c 10`
  - 1 object every 100ms: `-i 100`
  - to `test.log` file: `-o file://test.log`
  - using `sample` schema: `-s ./schema/sample.json`

### Example 2

> You can use `jq` to properly display the JSON event.

```bash
$ genjson -s ./schemas/sample.json | jq .
```

- Generates:
  - 1 JSON object
  - to the STDOUT
  - using `sample` schema: `-s ./schema/sample.json`

### Example 3

```bash
$ genjson -c 100 -i 1000 -o https://requestb.in/13s7hxv1 -s ./schemas/sample.json
```

- Generates:
  - 100 JSON objects: `-c 100`
  - 1 object every second: `-i 1000`
  - to an HTTP endpoint: `-o https://requestb.in/13s7hxv1`
  - using `sample` schema: `-s ./schema/sample.json`

### Example 4

```bash
$ genjson -c 5 -i 1000 -s schemas/sample.json | xargs -l1 sh -c 'echo "$@" | http POST requestb.in/13s7hxv1'
```

- Generates:
  - 5 JSON objects: `-c 5`
  - 1 object every second: `-i 1000`
  - using `sample` schema: `-s ./schema/sample.json`
  - to an HTTP endpoint using httpie:
  `| xargs -l1 sh -c 'echo "$@" | http POST requestb.in/13s7hxv1'`


## Extensions

You can extend the generation of fake data by adding your own custom generator.

**Example:**

Create a new file (suffixed by `.fake.js`) into the `custom-faker` directory:

```bash
vi custom-faker/foo.fake.js
```

Export a function having a `faker` instance as parameter:

```js
'use strict'

function Foo (faker) {
  this.bar = function (val) {
    return `FOO - {val}`
  }
}

module['exports'] = Foo
```

*Note: this example of a faker function called `bar` having a parameter.*

Now you can use this new faker into you JSON schema:

```json
{
  "id": "Sample",
  "type": "object",
  "properties": {
    "id": {"type": "string", "x-faker": "random.uuid"},
    "sample": {
      "type": "string",
      "x-faker": {"foo.bar": "hello"}
    }
  }
}
```

You will get the following result:

```json
{
  "id": "e6e53833-57e1-4a5b-aa04-7883bd29c57c",
  "sample": "FOO - hello"
}
```

---

[json-schema-faker]: https://github.com/json-schema-faker/json-schema-faker
[faker.js]: https://github.com/marak/Faker.js/#api-methods
[json-schema]: https://json-schema.org/specification.html
