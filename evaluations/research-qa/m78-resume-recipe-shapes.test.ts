import {test,expect} from 'bun:test'
import {m78RecipeVersionRecord,m78RecipeRetainedReview} from '../../tools/staging/m78-recipe-rehearsal'
const id='78000000-0000-4000-8000-000000000001',reviewId='78000000-0000-4000-8000-000000000002';
const review={id:reviewId,versionId:id,decision:'accepted_bounded_internal'};
test('legacy numeric revision and M78 envelope produce the saved record identity',()=>{
 for(const stream of ['inventoryId','worksheetId','rosterId','streamId']){
  const flat={id,version:9,[stream]:id,review};
  expect(m78RecipeVersionRecord(flat)).toBe(flat);
  expect(m78RecipeVersionRecord({version:flat,proof:{}})).toBe(flat);
  expect(m78RecipeRetainedReview(flat,id,reviewId)).toBe(review);
  expect(m78RecipeRetainedReview({version:flat,proof:{}},id,reviewId)).toBe(review);
 }
});
test('discovery register selects only the exact retained review',()=>{
 const other={...review,id:'78000000-0000-4000-8000-000000000003'};
 expect(m78RecipeRetainedReview({reviews:[other,review]},id,reviewId)).toBe(review);
 for(const reviews of [[],[other],[review,review],[{...review,versionId:other.id}]])expect(()=>m78RecipeRetainedReview({reviews},id,reviewId)).toThrow();
 expect(()=>m78RecipeRetainedReview({id,version:9,review:null},id,reviewId)).toThrow();
 expect(()=>m78RecipeRetainedReview({id,version:9,review:other},id,reviewId)).toThrow();
});
test('malformed version shapes cannot create undefined retained GET identities',()=>{
 for(const v of [null,9,{},[],{version:9},{id,version:0},{id,version:1.5},{version:null},{version:{id:'bad',version:1}},{version:{id,version:'1'}}])expect(()=>m78RecipeVersionRecord(v)).toThrow();
});
