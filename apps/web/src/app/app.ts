import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'ol-root',
  template: '<router-outlet />',
})
export class App {}
