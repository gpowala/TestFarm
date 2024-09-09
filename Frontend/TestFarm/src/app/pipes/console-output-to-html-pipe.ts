import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'consoleOutputToHtml'
})
export class ConsoleOutputToHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    // Replace newlines with <br> tags
    let result = value.replace(/\n/g, '<br>');

    // Replace tabs with &nbsp; (non-breaking spaces)
    result = result.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');

    // Preserve other whitespace
    result = result.replace(/ /g, '&nbsp;');

    // Sanitize the result to prevent XSS attacks
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }
}