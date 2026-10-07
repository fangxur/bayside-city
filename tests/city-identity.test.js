import test from 'node:test';
import assert from 'node:assert/strict';
import { CitySimulation } from '../src/simulation.js';

test('city identity trims and updates both names together, persists them, and allows clearing the mayor', () => {
  const city = new CitySimulation({ demo: true });
  const before = structuredClone(city.state);
  assert.equal(city.state.mayorName, '');
  assert.equal(city.setCityIdentity({ cityName: '  星河市  ', mayorName: '  方旭  ' }).ok, true);
  assert.equal(city.state.districtName, '星河市'); assert.equal(city.state.mayorName, '方旭');
  assert.deepEqual(city.state, { ...before, districtName: '星河市', mayorName: '方旭' }, 'identity changes no money, time, RNG or city simulation state');
  const restored = CitySimulation.deserialize(city.serialize());
  assert.deepEqual(restored.state, city.state);
  assert.equal(restored.setCityIdentity({ cityName: '星河市', mayorName: '   ' }).ok, true);
  assert.equal(CitySimulation.deserialize(restored.serialize()).state.mayorName, '');
});

test('invalid identity edits reject atomically without changing a valid name or removing construction undo', () => {
  const city = new CitySimulation(); city.setCityIdentity({ cityName: '原来的城', mayorName: '原来的市长' });
  assert.equal(city.build('road', [{ x: 8, y: 32 }]).ok, true);
  const before = city.serialize();
  for (const invalid of [
    null, [], undefined, '新城市', {},
    { cityName: 42, mayorName: '新市长' }, { cityName: '新城市', mayorName: null },
    { cityName: '', mayorName: '新市长' }, { cityName: '  ', mayorName: '新市长' },
    { cityName: '城'.repeat(25), mayorName: '新市长' },
    { cityName: '新城市', mayorName: '长'.repeat(25) },
  ]) {
    assert.equal(city.setCityIdentity(invalid).ok, false);
    assert.equal(city.serialize(), before);
  }
  assert.equal(city.undo().ok, true, 'a rejected edit preserves the prior construction action');
  assert.equal(city.state.districtName, '原来的城'); assert.equal(city.state.mayorName, '原来的市长');
});

test('valid identity management clears older undo while later construction undo keeps the new signature', () => {
  const city = new CitySimulation();
  city.build('road', [{ x: 8, y: 32 }]);
  assert.equal(city.setCityIdentity({ cityName: '新城市', mayorName: '新市长' }).ok, true);
  assert.equal(city.undo().ok, false);
  city.build('road', [{ x: 9, y: 32 }]); assert.equal(city.undo().ok, true);
  assert.equal(city.state.districtName, '新城市'); assert.equal(city.state.mayorName, '新市长');
  assert.equal(city.setCityIdentity({ cityName: '城'.repeat(24), mayorName: '长'.repeat(24) }).ok, true);
});

test('older saves default to an empty mayor without other changes, and new malformed mayor fields reject', () => {
  const city = new CitySimulation({ demo: true });
  const old = JSON.parse(city.serialize()); delete old.mayorName;
  assert.deepEqual(CitySimulation.deserialize(JSON.stringify(old)).state, city.state);
  for (const invalid of [null, 42, true, [], {}, '长'.repeat(25)]) {
    const raw = JSON.parse(city.serialize()); raw.mayorName = invalid;
    assert.throws(() => CitySimulation.deserialize(JSON.stringify(raw)));
  }
});

test('city hall details reflect the identity, while legacy district-name coercion and truncation remain compatible', () => {
  const city = new CitySimulation({ demo: true });
  assert.equal(city.build('cityHall', [{ x: 10, y: 23 }]).ok, true);
  assert.equal(city.getInfo(10, 23).metrics.find(m => m.label === '市长姓名').value, '尚未署名');
  city.setCityIdentity({ cityName: '星河市', mayorName: '方旭' });
  const info = city.getInfo(10, 23);
  assert.equal(info.title, '星河市 · 市政府');
  assert.equal(info.metrics.find(m => m.label === '城市名称').value, '星河市');
  assert.equal(info.metrics.find(m => m.label === '市长姓名').value, '方旭');
  assert.equal(city.setDistrictName(42).ok, true); assert.equal(city.state.districtName, '42');
  city.setDistrictName('城'.repeat(30)); assert.equal(city.state.districtName.length, 24);
  assert.equal(city.state.mayorName, '方旭');
});
