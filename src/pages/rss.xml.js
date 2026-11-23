import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

import { postUrl, sortPostsNewestFirst } from '../lib/posts';
import { siteDescription, siteName } from '../lib/site';

export async function GET(context) {
  const posts = sortPostsNewestFirst(await getCollection('posts'));

  return rss({
    title: siteName,
    description: siteDescription,
    site: context.site,
    customData: '<language>it</language>',
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: postUrl(post),
      pubDate: post.data.publishedAt,
      customData: `<dc:language>${post.data.lang}</dc:language>`,
    })),
  });
}
