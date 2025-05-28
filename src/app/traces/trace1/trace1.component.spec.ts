import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trace1Component } from './trace1.component';

describe('Trace1Component', () => {
  let component: Trace1Component;
  let fixture: ComponentFixture<Trace1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trace1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Trace1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
