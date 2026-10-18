/**
 * The render host page. It mounts the template named in `?job=` with the apps' stylesheet and
 * marks the body ready once the page is drawn and its webfonts have loaded.
 */
import '@rivr/ui/styles.css';
import { I18nProvider } from '@rivr/i18n';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { parseHostJob } from '../parse/job.ts';

/** Sets `data-render-ready` after the first commit, once the fonts the layout asked for are in. */
function SignalReady() {
  useEffect(() => {
    // Reading layout makes the browser request the webfonts the page uses.
    document.body.getBoundingClientRect();
    void document.fonts.ready.then(() => {
      document.body.dataset.renderReady = 'true';
    });
  }, []);
  return null;
}

const { element, locale } = parseHostJob(window.location.search);
document.documentElement.lang = locale;

const container = document.getElementById('root');
if (!container) throw new Error('The render host page has no #root element.');

createRoot(container).render(
  <I18nProvider locale={locale}>
    {element}
    <SignalReady />
  </I18nProvider>,
);
