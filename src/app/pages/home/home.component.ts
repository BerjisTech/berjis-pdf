import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../api.service';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html'
})
export class HomePageComponent {
  authed: boolean | null = null;
  recents: Array<{ id: string; title: string; updatedAt: string }> = [];
  constructor(private api: ApiService) { this.init(); }
  async init() {
    try {
      const res = await this.api.ensureAuth();
      this.authed = !!res?.data?.valid;
      if (this.authed) {
        this.recents = [
          { id: 'contract', title: 'MSA - ACME.pdf', updatedAt: new Date().toISOString() },
          { id: 'report', title: 'Quarterly Report.pdf', updatedAt: new Date(Date.now() - 8*3600e3).toISOString() }
        ];
      }
    } catch { this.authed = false; }
  }
}

