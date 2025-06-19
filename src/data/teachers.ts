export interface Teacher {
  name: string;
  furigana: string;
  prefecture: string;
  city: string;
  genres: string[];
  tags?: string[];
  profile: string;
  photo: string;
  courses: LessonCourse[];
}

export type LessonType = '自宅' | 'スタジオ' | '出張';

export interface LessonCourse {
  type: LessonType;
  title: string;
  price: string;
  note?: string;
  locationDisplay?: string; // 自宅レッスンでの町名表示
}

export const teachers: Teacher[] = [
  {
    name: '印田 陽介',
    furigana: 'いんだ ようすけ',
    prefecture: '東京都',
    city: '世田谷区',
    genres: ['チェロ'],
    tags: ['初心者歓迎', '体験レッスンあり', '出張可'],
    profile:
      '東京藝術大学音楽学部卒業。桐朋オーケストラアカデミー研修課程修了。現在はフリーランス奏者として活動中。',
    photo: 'yosuke.jpg',
    courses: [
      {
        type: '自宅',
        title: '60分レッスン',
        price: '6,000円',
        locationDisplay: '東京都世田谷区桜新町'
      },
      {
        type: '自宅',
        title: '30分レッスン（小学生以下・初回体験）',
        price: '4,000円',
        locationDisplay: '東京都世田谷区桜新町'
      },
      {
        type: '自宅',
        title: '室内楽レッスン（60分）',
        price: '10,000円',
        locationDisplay: '東京都世田谷区桜新町'
      },
      {
        type: '自宅',
        title: '室内楽レッスン 延長（60分）',
        price: '6,000円',
        locationDisplay: '東京都世田谷区桜新町'
      },
      {
        type: 'スタジオ',
        title: 'スタジオレッスン（60分）',
        price: '7,000円',
        note: 'スタジオ代別・応相談'
      },
      {
        type: '出張',
        title: '出張レッスン（60分）',
        price: '8,000円',
        note: '東京都内中心・応相談'
      }
    ]
  },
  {
  name: '高岡 準',
  furigana: 'たかおか ひとし',
  prefecture: '埼玉県',
  city: 'さいたま市浦和区',
  genres: ['ピアノ'],
  tags: ['初心者歓迎'],
  profile: '東京藝術大学卒業後、国内外で演奏活動を行う。教育にも力を入れ、地域の音楽教育に貢献。',
  photo: '/hitoshi.jpg',
  courses: [
    {
      type: '自宅',
      title: '60分レッスン',
      price: '5,000円',
      locationDisplay: '埼玉県さいたま市浦和区領家'
    },
    {
      type: 'スタジオ',
      title: 'スタジオレッスン（60分）',
      price: '6,000円',
      note: '浦和駅近くの音楽スタジオにて（スタジオ代込）'
    },
    {
      type: '出張',
      title: '出張レッスン（60分）',
      price: '7,000円',
      note: '埼玉県南部を中心に対応'
    }
  ]
}
];
