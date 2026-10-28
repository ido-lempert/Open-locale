import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { LoginComponent } from './pages/login.component';
import { ProjectsComponent } from './pages/projects.component';
import { EditorComponent } from './pages/editor.component';
import { SettingsComponent } from './pages/settings.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'projects', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'projects/:id', component: EditorComponent, canActivate: [authGuard] },
  { path: 'projects/:id/settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
