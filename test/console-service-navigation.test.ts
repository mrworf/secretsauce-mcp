import { describe, expect, it } from 'vitest';
import { serviceEditorStep } from '../src/consoleServicePage.js';

describe('stable service section routes',()=>{
  it('keeps editable sections and redirects the removed detection entry to policy',()=>{
    expect(['0','1','2','3','4','5'].map(s=>serviceEditorStep(s))).toEqual([0,1,2,3,4,3]);
  });
  it('keeps the separate readonly Review index and maps detection to policy',()=>{
    expect(['0','1','2','3','4','5'].map(s=>serviceEditorStep(s,true))).toEqual([0,1,2,3,3,4]);
  });
  it('rejects malformed and out of range locations rather than guessing a section',()=>{
    for(const value of ['', '6','-1','03','3.0',' 3','3 ','NaN','Infinity','secret-detection','<script>']){
      expect(serviceEditorStep(value)).toBeNull();
      expect(serviceEditorStep(value,true)).toBeNull();
    }
  });
});
