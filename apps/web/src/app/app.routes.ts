import { SamlCallbackComponent } from './pages/saml-callback.component';
import { Routes } from '@angular/router';
import { OidcCallbackComponent } from './pages/oidc-callback.component';
import { authGuard } from './auth.guard';
import { LoginComponent } from './pages/login.component';
import { ProjectsComponent } from './pages/projects.component';
import { EditorComponent } from './pages/editor.component';

export const appRoutes: Routes = [
  { path: 'auth/saml/callback', component: SamlCallbackComponent },
  { path: 'auth/oidc/callback', component: OidcCallbackComponent },
  { path: 'login', component: LoginComponent },
  { path: 'account/identities', loadComponent: () => import('./pages/identities.component').then(m => m.IdentitiesComponent), canActivate: [authGuard] },
  { path: 'account/link-saml', loadComponent: () => import('./pages/identity-link.component').then(m => m.IdentityLinkComponent), data: { provider: 'saml' }, canActivate: [authGuard] },
  { path: 'account/link-oidc', loadComponent: () => import('./pages/identity-link.component').then(m => m.IdentityLinkComponent), canActivate: [authGuard] },
  { path: 'projects', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'projects/:id', component: EditorComponent, canActivate: [authGuard] },
  { path: 'projects/:id/sync/targets', loadComponent: () => import('./pages/repository-targets.component').then(m => m.RepositoryTargetsComponent), canActivate: [authGuard] },
  { path: 'projects/:id/sync/history', loadComponent: () => import('./pages/sync-history.component').then(m => m.SyncHistoryComponent), canActivate: [authGuard] },
  { path: 'projects/:id/sync', loadComponent: () => import('./pages/sync-preview.component').then(m => m.SyncPreviewComponent), canActivate: [authGuard] },
  { path: 'projects/:id/webhooks/:hookId/deliveries', loadComponent: () => import('./pages/webhook-deliveries.component').then(m => m.WebhookDeliveriesComponent), canActivate: [authGuard] },
  { path: 'projects/:id/ota/:version/:locale', loadComponent: () => import('./pages/ota-bundle.component').then(m => m.OtaBundleComponent), canActivate: [authGuard] },
  { path: 'projects/:id/settings', loadComponent: () => import('./pages/settings.component').then(m => m.SettingsComponent), canActivate: [authGuard] },
  { path: 'projects/:id/activity', loadComponent: () => import('./pages/activity.component').then(m => m.ActivityComponent), canActivate: [authGuard] },
  { path: 'projects/:id/tasks', loadComponent: () => import('./pages/tasks.component').then(m => m.TasksComponent), canActivate: [authGuard] },
  { path: 'projects/:id/glossary', loadComponent: () => import('./pages/glossary.component').then(m => m.GlossaryComponent), canActivate: [authGuard] },
  { path: 'projects/:id/qa', loadComponent: () => import('./pages/qa.component').then(m => m.QaComponent), canActivate: [authGuard] },
  { path: 'projects/:id/snapshots', loadComponent: () => import('./pages/snapshots.component').then(m => m.SnapshotsComponent), canActivate: [authGuard] },
  { path: 'projects/:id/reports', loadComponent: () => import('./pages/reports.component').then(m => m.ReportsComponent), canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
