import { Component, Input } from '@angular/core';

/**
 * Shared SVG icon. Usage: <app-icon name="sort" class="icon-sort"></app-icon>
 * The host element carries the sizing (class / inline width-height); the inner
 * <svg> fills the host (see app-icon rules in src/styles/_icons.css).
 * Icon names are defined in icon.component.html.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
})
export class IconComponent {
  @Input() name: string = '';
}
