import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'ol-login',
  imports: [FormsModule],
  template: `
    <main class="auth-card">
      <h1>Open-locale</h1>
      <p class="muted">Open-source localization management</p>
      <div class="tabs">
        <button [class.active]="mode() === 'login'" (click)="mode.set('login')">Log in</button>
        <button [class.active]="mode() === 'signup'" (click)="mode.set('signup')">Sign up</button>
      </div>
      <form (ngSubmit)="submit()">
        @if (mode() === 'signup') {
          <label>Name <input [(ngModel)]="displayName" name="displayName" required autocomplete="name" /></label>
        }
        <label>Email <input type="email" [(ngModel)]="email" name="email" required autocomplete="email" /></label>
        <label>Password <input type="password" [(ngModel)]="password" name="password" required
          [attr.minlength]="mode() === 'signup' ? 8 : null"
          [attr.autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'" /></label>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Working…' : mode() === 'login' ? 'Log in' : 'Create account' }}
        </button>
      </form>
    </main>
  `,
})
export class LoginComponent {
  mode = signal<'login' | 'signup'>('login');
  email = ''; password = ''; displayName = '';
  busy = signal(false); error = signal('');
  constructor(private api: ApiService, private router: Router) {}
  async submit() {
    this.busy.set(true); this.error.set('');
    try {
      const res = this.mode() === 'login'
        ? await this.api.login(this.email, this.password)
        : await this.api.signup(this.email, this.password, this.displayName);
      this.api.token = res.accessToken;
      await this.router.navigate(['/projects']);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
}
