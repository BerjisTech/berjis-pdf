import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Routes } from '@angular/router';
import { AppComponent } from './app/app.component';
import { HomePageComponent } from './app/pages/home/home.component';
import { authGuard } from './app/auth.guard';

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'pdf/:id', loadComponent: () => import('./app/pages/pdf/pdf.component').then(m => m.PdfPageComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideRouter(routes)]
}).catch(err => console.error(err));
