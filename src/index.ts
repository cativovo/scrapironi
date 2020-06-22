import axios from 'axios';
import cors from 'cors';
import express from 'express';
import { load } from 'cheerio';

type RankData = Record<'rank' | 'changeInRank' | 'category' | 'rankHistory', string>;
type RanksInPlatforms = Record<string, RankData[]>;

const scrapeRanking = async (podcast: string): Promise<RanksInPlatforms> => {
  const url = `https://chartable.com/podcasts/${podcast}/charts_partial`;

  const res = await axios.get(url);
  const $ = load(res.data);
  const podcasts = $('div')
    .children()
    .toArray()
    .reduce<{ podcastName: string; table: CheerioElement }[]>((acc, el) => {
      if (el.attribs.class.includes('gray')) {
        const podcastName = $(el).text().trim();
        const table = el.nextSibling.next;
        return [...acc, { podcastName, table }];
      }
      return acc;
    }, []);

  const [, , applePodcastTable, , spotifyTable] = $('div').children().toArray();

  const getRankings = (chartType: string) => (
    ranksInPlatForm: RankData[],
    trElement: CheerioElement,
    index: number
  ): RankData[] => {
    if (index === 0) {
      return ranksInPlatForm;
    }
    const [rank, changeInRank, category, rankHistory] = $(trElement).find('td').toArray();
    const rankHistoryHref = $(rankHistory).find('a').attr('href') as string;

    const rankData = {
      rank: $(rank).text().trim(),
      changeInRank: $(changeInRank).text().trim(),
      category: $(category).text().trim(),
      rankHistory: `https://chartable.com/api/podcasts/${podcast}/rank_history?chart_id=${rankHistoryHref.slice(
        rankHistoryHref.lastIndexOf('/') + 1
      )}&chart_type=${chartType}`,
    };

    return [...ranksInPlatForm, rankData];
  };

  return podcasts.reduce<Record<string, RankData[]>>((acc, el) => {
    const data = $(el.table).find('tr').toArray().reduce<RankData[]>(getRankings('spotify'), []);
    const key = el.podcastName
      .split(' ')
      .map((str, index) => {
        if (index === 0) {
          return str.toLowerCase();
        }
        return str;
      })
      .join('');
    return { ...acc, [key]: data };
  }, {});
};

const app = express();

app.use(cors());

app.get('/:podcast', async (req, res) => {
  const { podcast } = req.params;
  const ranksInPlatforms = await scrapeRanking(podcast);

  res.send(ranksInPlatforms);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`listening on http://localhost:${PORT}`));
