import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesEntityTag,queryFilters,validMediaKey} from '../src/catalog';
test('SQL injection search is bound as data and pagination is bounded',()=>{
 const f=queryFilters(new URLSearchParams({q:"' OR 1=1; --",category:"x' OR 1=1",platform:'Web',limit:'999',offset:'-10'}));
 assert(!f.where.includes("OR 1=1"));assert.equal(f.bindings[0],"' or 1=1; --");assert.equal(f.limit,100);assert.equal(f.offset,0);
});
test('invalid pagination cannot bind NaN and unsupported enums are ignored',()=>{const f=queryFilters(new URLSearchParams({limit:'NaN',offset:'Infinity',pricing:'injected',platform:'injected'}));assert.equal(f.limit,60);assert.equal(f.offset,0);assert.equal(f.where,'');});
test('media keys exclude traversal and non-image objects',()=>{assert.equal(validMediaKey('/media/brand/logo.png'),'brand/logo.png');for(const p of ['/media/brand/%2e%2e/secrets.png','/media/brand/.env','/media/other/token.png','/media/brand/x.html','/media/%ZZ'])assert.equal(validMediaKey(p),null,p);});

test('media cache revalidation uses weak ETag comparison and supports lists',()=>{
 assert.equal(matchesEntityTag('W/"abc"','"abc"'),true);
 assert.equal(matchesEntityTag('"other", W/"abc"','"abc"'),true);
 assert.equal(matchesEntityTag('*','"abc"'),true);
 assert.equal(matchesEntityTag(null,'"abc"'),false);
 assert.equal(matchesEntityTag('W/"other"','"abc"'),false);
});
