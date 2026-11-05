import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });
  it('renders a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});

describe('navigation feedback event identity',()=>{
 it('announces current navigation only, fixed error and clears on next start',()=>{
   const {Subject}=require('rxjs'),{NavigationStart,NavigationEnd,NavigationError,NavigationCancel}=require('@angular/router');
   const events=new Subject(),app=new App({events} as never);
   events.next(new NavigationStart(1,'/private?token=secret'));expect(app.navigating()).toBe(true);expect(app.navigationFailed()).toBe(false);
   events.next(new NavigationStart(2,'/next'));events.next(new NavigationError(1,'/private',new Error('private')));expect(app.navigating()).toBe(true);expect(app.navigationFailed()).toBe(false);
   events.next(new NavigationError(2,'/next',new Error('private')));expect(app.navigating()).toBe(false);expect(app.navigationFailed()).toBe(true);
   events.next(new NavigationStart(3,'/another'));expect(app.navigationFailed()).toBe(false);events.next(new NavigationEnd(2,'/next','/next'));expect(app.navigating()).toBe(true);events.next(new NavigationEnd(3,'/another','/another'));expect(app.navigating()).toBe(false);
   events.next(new NavigationStart(4,'/cancel'));events.next(new NavigationCancel(4,'/cancel','private cancellation'));expect(app.navigating()).toBe(false);expect(app.navigationFailed()).toBe(false);
   app.ngOnDestroy();events.next(new NavigationStart(5,'/destroyed'));expect(app.navigating()).toBe(false);
 });
 it('renders safe error without source error URL or destructive reload action',async()=>{
   const {Subject}=require('rxjs'),{Router,NavigationStart,NavigationError}=require('@angular/router'),events=new Subject();
   await TestBed.configureTestingModule({imports:[App],providers:[provideRouter([])]}).compileComponents();const router=TestBed.inject(Router);jest.spyOn(router.events,'subscribe').mockImplementation((fn:any)=>events.subscribe(fn));const fixture=TestBed.createComponent(App);events.next(new NavigationStart(1,'/secret-url'));events.next(new NavigationError(1,'/secret-url',new Error('secret-error')));fixture.detectChanges();const el=fixture.nativeElement as HTMLElement;expect(el.querySelector('[name=navigationFailed]')?.textContent).toContain('Keep any unsaved work');expect(el.textContent).not.toMatch(/secret-url|secret-error/);expect(el.querySelector('button')).toBeNull();expect(el.querySelector('router-outlet')).toBeTruthy();fixture.destroy();
 });
});
