const {validateTestDatabase,assertManagedTest}=require('../scripts/test-environment.cjs');
test.each([undefined,'invalid','https://localhost/smartlab_test','postgresql://remote.example/smartlab_test','postgresql://localhost/production','postgresql://localhost/smartlab_test?schema=public'])('rejects unsafe database configuration %s',value=>expect(()=>validateTestDatabase(value)).toThrow());
test('accepts explicit local test database',()=>expect(validateTestDatabase('postgresql://localhost/smartlab_test').pathname).toBe('/smartlab_test'));
test('rejects direct test execution and mismatched schema',()=>{expect(()=>assertManagedTest({})).toThrow();expect(()=>assertManagedTest({...process.env,SMARTLAB_TEST_SCHEMA:'public'})).toThrow()});
