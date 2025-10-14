import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-pdf',
  imports: [CommonModule],
  template: `<div class="border rounded p-4">PDF viewer placeholder (DIY viewer slot)</div>`
})
export class PdfPageComponent {}

