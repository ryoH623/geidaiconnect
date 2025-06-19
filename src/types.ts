export interface Teacher {
    name: string;
    furigana: string;
    subject: string;
    location: {
      prefecture: string;
      city: string;
    };
    profile: string;
    image: string;
    course: {
      duration: string;
      price: string;
    }[];
  }
  