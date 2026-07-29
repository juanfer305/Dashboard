const test = require('node:test');
const assert = require('node:assert/strict');

const generateDescriptionHandler = require('../api/generate-description');

test('generate-description devuelve una respuesta válida', async () => {
  const req = {
    method: 'POST',
    body: { text: 'Diseño de logo', documentType: 'invoice' },
  };

  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };

  await generateDescriptionHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(typeof res.body.result === 'string' && res.body.result.length > 0);
});
