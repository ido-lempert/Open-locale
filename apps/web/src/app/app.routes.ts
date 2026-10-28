import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { LoginComponent } from './pages/login.component';
import { ProjectsComponent } from './pages/projects.component';
import { EditorComponent } from './pages/editor.component';
import { SettingsComponent } from './pages/settings.component';
import { ActivityComponent } from './pages/activity.component';
import { TasksComponent } from './pages/tasks.component';
import { GlossaryComponent } from './pages/glossary.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'projects', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'projects/:id', component: EditorComponent, canActivate: [authGuard] },
  { path: 'projects/:id/settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'projects/:id/activity', component: ActivityComponent, canActivate: [authGuard] },
  { path: 'projects/:id/tasks', component: TasksComponent, canActivate: [authGuard] },
  { path: 'projects/:id/glossary', component: GlossaryComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
