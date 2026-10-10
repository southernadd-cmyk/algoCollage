export const MAX_IMAGES = 24;
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
export const RASTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export function safeURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function plainText(value) {
  const text = String(value || '').replace(/<[^>]*>/g, '');
  if (typeof DOMParser !== 'undefined') return new DOMParser().parseFromString(text, 'text/html').body.textContent.trim().slice(0, 600);
  return text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().slice(0, 600);
}

export function recognisedLicense(label) {
  const s = plainText(label).toLowerCase().trim();
  if (/^(cc0(?: 1\.0)?|cc-zero)$/.test(s)) return 'cc0';
  if (/^(public domain(?: mark)?(?: 1\.0)?|pdm)$/.test(s)) return 'pdm';
  if (/^(?:cc )?by-sa(?: [1-4]\.0)?$/.test(s)) return 'by-sa';
  if (/^(?:cc )?by(?: [1-4]\.0)?$/.test(s)) return 'by';
  return '';
}
const eligible = (label, policy) => {
  const code = recognisedLicense(label);
  return !!code && (policy === 'attribution' || ['cc0', 'pdm'].includes(code));
};

export function searchURL(provider, query, policy = 'public', page = 1) {
  const q = query.trim().slice(0, 200);
  if (!q) throw new Error('Enter a subject to search for.');
  if (provider === 'openverse') {
    const u = new URL('https://api.openverse.org/v1/images/');
    u.search = new URLSearchParams({q, license: policy === 'attribution' ? 'cc0,pdm,by,by-sa' : 'cc0,pdm',
      page_size:'20', page:String(page), mature:'false', filter_dead:'true', extension:'jpg,jpeg,png,webp'});
    return u.href;
  }
  if (provider !== 'commons') throw new Error('Unknown image source.');
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  u.search = new URLSearchParams({action:'query', format:'json', formatversion:'2', origin:'*',
    generator:'search', gsrsearch:q + ' filetype:bitmap', gsrnamespace:'6', gsrlimit:'20', gsroffset:String((page-1)*20),
    prop:'imageinfo', iiprop:'url|mime|size|extmetadata', iiurlwidth:'1600', iiurlheight:'1600',
    iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl|ObjectName', iiextmetadatalanguage:'en'});
  return u.href;
}

export function parseResults(provider, data, query, policy = 'public') {
  if (data.error) throw new Error(plainText(data.error.info || 'The image source returned an error.'));
  if (provider === 'openverse') {
    if (!Array.isArray(data.results)) throw new Error('Openverse returned an unexpected response.');
    return data.results.filter(i => !i.mature && eligible(i.license, policy)).map(i => ({
      id: `openverse:${i.id}`, title:plainText(i.title || 'Untitled image'), creator:plainText(i.creator),
      url:safeURL(i.url), thumbnail:safeURL(i.thumbnail || i.url), sourceUrl:safeURL(i.foreign_landing_url),
      license:i.license.toUpperCase() + (i.license_version ? ' ' + i.license_version : ''),
      licenseUrl:safeURL(i.license_url), provider:'Openverse', query
    })).filter(i => i.url && i.thumbnail && i.sourceUrl);
  }
  return (data.query?.pages || []).sort((a,b) => a.index-b.index).map(p => {
    const i=p.imageinfo?.[0], m=i?.extmetadata;
    if (!i || !RASTER_TYPES.includes(i.mime) || !eligible(m?.LicenseShortName?.value, policy)) return null;
    return {id:`commons:${p.pageid}`, title:plainText(m.ObjectName?.value || p.title.replace(/^File:/,'')),
      creator:plainText(m.Artist?.value), url:safeURL(i.thumburl || i.url), thumbnail:safeURL(i.thumburl || i.url),
      sourceUrl:safeURL(i.descriptionurl), license:plainText(m.LicenseShortName.value),
      licenseUrl:safeURL(m.LicenseUrl?.value), provider:'Wikimedia Commons', query};
  }).filter(i => i && i.url && i.thumbnail && i.sourceUrl);
}

export async function searchImages(provider, query, policy, page, signal) {
  const response = await fetch(searchURL(provider, query, policy, page), {signal, credentials:'omit', mode:'cors'});
  if (response.status === 429) throw new Error('This source is busy or its search limit has been reached. Try again later or switch source.');
  if (!response.ok) throw new Error(`The image source could not be reached (${response.status}). Try the other source or upload images.`);
  const data = await response.json();
  return {images:parseResults(provider,data,query,policy), hasMore:provider==='openverse' ? page<(data.page_count||1) : !!data.continue};
}

export async function fetchImage(item, signal) {
  const response = await fetch(item.url, {signal, mode:'cors', credentials:'omit'});
  if (!response.ok) throw new Error('This image host did not allow the download. Try another image or upload a saved copy.');
  const length=Number(response.headers.get('content-length'));
  if (length > MAX_IMAGE_BYTES) throw new Error('This image is too large. Choose a smaller image.');
  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES || !RASTER_TYPES.includes(blob.type)) throw new Error('Choose a JPEG, PNG, WebP, GIF or AVIF under 16 MB.');
  return blob;
}

export function creditsText(scene, images) {
  const used = new Set(scene.pieces.map(p => p.imageId));
  const lines = ['ALGO/COLLAGE — source credits', '', 'Images have been cropped, cut into fragments and rearranged.',
    'Cut seed: '+scene.settings.cutSeed, 'Layout seed: '+scene.settings.layoutSeed, 'Image seed: '+scene.settings.imageSeed,
    '', 'Source licences describe the original images. Retain these credits when sharing.',
    'CC BY-SA sources may impose ShareAlike terms on adaptations; follow each linked source licence.', ''];
  for (const image of images.filter(i => used.has(i.id))) {
    lines.push(image.title, 'Creator: '+(image.creator || 'Not supplied; see source'), 'Licence: '+image.license);
    if (image.sourceUrl) lines.push('Source: '+image.sourceUrl);
    if (image.licenseUrl) lines.push('Licence terms: '+image.licenseUrl);
    lines.push('');
  }
  return lines.join('\n');
}
