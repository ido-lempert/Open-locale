import { Component, OnDestroy, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  imports: [RouterModule],
  selector: 'ol-root',
  styles: [`.route-feedback{position:fixed;bottom:0;left:0;right:0;z-index:1000;box-sizing:border-box;box-shadow:0 -2px 8px #0002;padding:.75rem 1rem;margin:0;background:#fff4dc;border-top:1px solid #dbcaa7;color:#332700}`],
  template: `
    @if (navigating()) { <p class="route-feedback" role="status" name="navigationPending">Opening page...</p> }
    @if (navigationFailed()) { <p class="route-feedback" role="alert" name="navigationFailed">Page could not open. The previous screen may still be visible. Keep any unsaved work before refreshing, or try another link. No automatic refresh was performed.</p> }
    <router-outlet />`,
})
export class App implements OnDestroy {
  navigating = signal(false);
  navigationFailed = signal(false);
  private activeId: number | null = null;
  private subscription: Subscription;
  constructor(router: Router) {
    this.subscription = router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.activeId = event.id;
        this.navigationFailed.set(false);
        this.navigating.set(true);
      } else if ((event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) && event.id === this.activeId) {
        this.activeId = null;
        this.navigating.set(false);
        this.navigationFailed.set(event instanceof NavigationError);
      }
    });
  }
  ngOnDestroy() { this.subscription.unsubscribe(); }
}
