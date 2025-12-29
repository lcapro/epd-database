import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEpd, parseEpdNormalized } from '../lib/epdParser';

const asphaltText = readFileSync(new URL('./fixtures/asphalt.txt', import.meta.url), 'utf8');
const pvcText = readFileSync(new URL('./fixtures/pvc.txt', import.meta.url), 'utf8');

describe('EPD parser registry', () => {
  it('keeps asphalt parsing output stable', () => {
    const parsed = parseEpd(asphaltText);

    assert.deepStrictEqual(parsed, {
      productName: 'EPD asfalt',
      functionalUnit: '1 ton',
      producerName: 'Asfalt BV',
      lcaMethod: 'NMD Bepalingsmethode 1.1',
      pcrVersion: 'PCR Asfalt 1.0',
      databaseName: 'NMD v3.5 | EcoInvent v3.6',
      databaseNmdVersion: 'NMD v3.5',
      databaseEcoinventVersion: 'EcoInvent v3.6',
      publicationDate: '2022-01-01',
      expirationDate: '2027-01-01',
      verifierName: 'J. Doe',
      standardSet: 'SBK_SET_1',
      impacts: [
        { indicator: 'MKI', setType: 'SBK_SET_1', stage: 'A1', value: 1, unit: 'Euro' },
        { indicator: 'MKI', setType: 'SBK_SET_1', stage: 'A2', value: 2, unit: 'Euro' },
        { indicator: 'MKI', setType: 'SBK_SET_1', stage: 'A3', value: 3, unit: 'Euro' },
        { indicator: 'MKI', setType: 'SBK_SET_1', stage: 'A1-A3', value: 6, unit: 'Euro' },
        { indicator: 'MKI', setType: 'SBK_SET_1', stage: 'D', value: 7, unit: 'Euro' },
        { indicator: 'GWP', setType: 'SBK_SET_1', stage: 'A1', value: 10, unit: 'kg CO2' },
        { indicator: 'GWP', setType: 'SBK_SET_1', stage: 'A2', value: 20, unit: 'kg CO2' },
        { indicator: 'GWP', setType: 'SBK_SET_1', stage: 'A3', value: 30, unit: 'kg CO2' },
        { indicator: 'GWP', setType: 'SBK_SET_1', stage: 'A1-A3', value: 60, unit: 'kg CO2' },
        { indicator: 'GWP', setType: 'SBK_SET_1', stage: 'D', value: 70, unit: 'kg CO2' },
      ],
    });
  });

  it('parses PVC Ecochain EPD with normalized LCA standard', () => {
    const parsed = parseEpdNormalized(pvcText);

    assert.equal(parsed.productName, 'U3 Pipe PVC 315 mm grijs');
    assert.equal(parsed.declaredUnit, '1 m');
    assert.equal(parsed.manufacturer, 'Wavin');
    assert.equal(parsed.issueDate, '2023-05-01');
    assert.equal(parsed.validUntil, '2028-05-01');
    assert.equal(parsed.lcaStandard.name, 'NMD Bepalingsmethode');
    assert.equal(parsed.lcaStandard.version, '1.1');
    assert.equal(parsed.verified, true);
    assert.equal(parsed.verifier, 'Martijn van Hövell - SGS Search');
    assert.equal(parsed.standardSet, 'SBK_SET_1');
    assert.equal(parsed.pcr, undefined);

    const mki = parsed.results.find((row) => row.indicator === 'MKI');
    assert.ok(mki);
    assert.equal(mki?.values.A1, 1);
    assert.equal(mki?.values.C4, 9);
    assert.equal(mki?.values.D, 10);
    assert.equal(mki?.values.Total, 11);
  });

  it('maps PVC impacts and database versions for UI', () => {
    const parsed = parseEpd(pvcText);

    assert.equal(parsed.databaseEcoinventVersion, 'EcoInvent v3.6');
    assert.equal(parsed.verifierName, 'Martijn van Hövell - SGS Search');
    assert.ok(parsed.impacts.length > 0);
  });

  it('selects the correct parser per PDF type', () => {
    const asphaltParsed = parseEpdNormalized(asphaltText);
    const pvcParsed = parseEpdNormalized(pvcText);

    assert.equal(asphaltParsed.rawExtract?.parserId, 'asphaltEcochainV1');
    assert.equal(pvcParsed.rawExtract?.parserId, 'pvcEcochainV1');
  });
});
