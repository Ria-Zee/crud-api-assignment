import { fetchPage } from './fetcher.js';

const url = 'https://books.toscrape.com/catalogue/page-1.html';
await fetchPage(url, 'catalogue-page-1');