# Photo slots

Put real PAD photos here with these exact filenames. Each one replaces its
branded placeholder automatically, no code changes needed. JPGs around
2000px on the long edge, under 500 KB each, keep the page fast.

| File | Where it shows | Status | Shot |
|---|---|---|---|
| hero.jpg | Full screen hero behind the headline | **Real PAD photo** | Convention, from `source-originals/IMG_7782.webp` |
| students.jpg | "Students" card | **Real PAD photo** | Initiation at FAMU College of Law, from `source-originals/640x480-PAD.jpg` |
| founders.jpg | "Founders" card | **Real PAD photo** | 1970s Kolleck Chapter, from `source-originals/frat_of_firsts.png` |
| alumni.jpg | "Alumni" card | Stock | Attorneys/judges handshake |
| heritage.jpg | Heritage timeline section | Stock | Archival-look books |
| wall-1.jpg | Photo wall | **Real PAD photo** | Initiation certificates, cropped square from `source-originals/about_us.png` |
| wall-2.jpg | Photo wall | Stock | Graduation day |
| wall-3.jpg | Photo wall | Stock | Mentorship conversation |
| wall-4.jpg | Photo wall | **Real PAD photo** | UC Merced Pre-Law Chapter, from `source-originals/pad.jpg` |
| wall-5.jpg | Photo wall | Stock | The courthouse steps |
| wall-6.jpg | Photo wall | Stock | Mentorship over coffee |
| wall-7.jpg | Photo wall | Stock | Alumni reception |
| cta.jpg | Final donate banner | Stock | Celebration / graduation |

Labels above must match `src/lib/photos.ts`, which is the source of truth for what each slot is captioned as on the page.

`source-originals/` holds the un-cropped photos as provided, in case a slot needs to be re-cropped differently later (e.g. `about_us.png` is a 2000x400 wide banner crop, currently center-left cropped to a square for `wall-1.jpg`).

Only use photos PAD has the rights to, with permission from anyone clearly identifiable. Stock photos here are Pexels, free commercial license — do not pull images from pad.org's own site, several of which are checked and confirmed to be third-party licensed stock, not PAD's to relicense.
