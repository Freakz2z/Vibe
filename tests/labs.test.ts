import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedInteger,escapeHtml,parseByteRange} from '../src/labs';
test('lab numeric inputs reject SQL, floats, exponent and oversized values',()=>{
 assert.equal(boundedInteger(null,400,0,1200),400);
 assert.equal(boundedInteger('0',400,0,1200),0);
 for(const bad of ['-1','1201','NaN','1e2','1.5','1 OR 1=1','9007199254740992',''])assert.equal(boundedInteger(bad,400,0,1200),null,bad);
});
test('single object ranges support bounded, open and suffix reads',()=>{
 assert.deepEqual(parseByteRange('bytes=0-63',100),{offset:0,length:64});
 assert.deepEqual(parseByteRange('bytes=90-999',100),{offset:90,length:10});
 assert.deepEqual(parseByteRange('bytes=90-',100),{offset:90,length:10});
 assert.deepEqual(parseByteRange('bytes=-12',100),{offset:88,length:12});
 assert.deepEqual(parseByteRange('bytes=-999',100),{offset:0,length:100});
 for(const bad of ['bytes=100-','bytes=3-1','bytes=-0','bytes=-','bytes=0-1,4-5','bits=0-1','bytes=1.5-3','bytes=9007199254740992-'])assert.equal(parseByteRange(bad,100),null,bad);
 assert.equal(parseByteRange('bytes=0-1',0),null);
});
test('server fragments encode every HTML-significant character',()=>{
 assert.equal(escapeHtml('<script a="x" data=\'y\'>&</script>'),'&lt;script a=&quot;x&quot; data=&#39;y&#39;&gt;&amp;&lt;/script&gt;');
});
