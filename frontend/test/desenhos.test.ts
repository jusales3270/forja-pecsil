import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codigoDoArquivo } from '../src/pages/Artigos/tabs/DesenhoModal';

test('código sugerido vem do nome do arquivo, sem extensão', () => {
  assert.equal(codigoDoArquivo('2IS-5-070-F-VFW.pdf'), '2IS-5-070-F-VFW');
  assert.equal(codigoDoArquivo('A16 01PA 0004 OOG rev0.PDF'), 'A16 01PA 0004 OOG rev0');
  assert.equal(codigoDoArquivo('foto.da.forma.jpeg'), 'foto.da.forma');
  assert.equal(codigoDoArquivo('sem-extensao'), 'sem-extensao');
});
