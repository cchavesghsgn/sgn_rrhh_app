import { strict as assert } from 'assert';
import { cargoBonusPct, factorUtilidad, ieaToBonus, pctToBonus, puntualidadIngreso } from '../lib/bonos-calculo';

const cases: Array<[string, number, number, (value: number) => number]> = [
  ['TPE/TAP below 80%', 0.7999, 0, pctToBonus],
  ['TPE/TAP at 80%', 0.8, 0.0166, pctToBonus],
  ['TPE/TAP at 90%', 0.9, 0.0333, pctToBonus],
  ['TPE/TAP below 100%', 0.9999, 0.0333, pctToBonus],
  ['TPE/TAP exactly 100%', 1, 0.06, pctToBonus],
  ['IEA below 40%', 0.3999, 0, ieaToBonus],
  ['IEA at 40%', 0.4, 0.015, ieaToBonus],
  ['IEA below 50%', 0.4999, 0.015, ieaToBonus],
  ['IEA at 50%', 0.5, 0.03, ieaToBonus],
  ['Utilidad below 10%', 9.99, 0, factorUtilidad],
  ['Utilidad at 10%', 10, 0.5, factorUtilidad],
  ['Utilidad below 15%', 14.99, 0.5, factorUtilidad],
  ['Utilidad at 15%', 15, 0.75, factorUtilidad],
  ['Utilidad below 20%', 19.99, 0.75, factorUtilidad],
  ['Utilidad at 20%', 20, 1, factorUtilidad],
  ['Utilidad at 30%', 30, 1, factorUtilidad],
  ['Utilidad above 30%', 30.01, 1.2, factorUtilidad]
];

for (const [label, input, expected, fn] of cases) {
  assert.equal(fn(input), expected, label);
}

console.log(`bonos rules ok (${cases.length} cases)`);

assert.equal(cargoBonusPct('Jefe Proyectos'), 0.2, 'Jefe Proyectos has 20% cargo bonus');
assert.equal(cargoBonusPct('jefe de proyectos'), 0.2, 'Jefe de proyectos normalized has 20% cargo bonus');
assert.equal(cargoBonusPct('Desarrollador'), 0, 'Other positions have no cargo bonus');

assert.deepEqual(puntualidadIngreso('07:59', 8 * 60), null, 'early arrival keeps strict punctuality');
assert.deepEqual(puntualidadIngreso('08:05', 8 * 60), {
  hora: '08:05',
  minutos: 5,
  esTardanza: false
}, 'arrival under 10 minutes loses strict punctuality but is not tardiness');
assert.deepEqual(puntualidadIngreso('08:11', 8 * 60), {
  hora: '08:11',
  minutos: 11,
  esTardanza: true
}, 'arrival over 10 minutes is tardiness');
