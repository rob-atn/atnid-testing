// Regression tests built from requests actually captured in Chrome, kept
// verbatim. Synthetic URLs test what we think Floodlight looks like; these
// test what it is. The endpoint shape here (/activity;src=) is a third form
// that neither of the shapes in the documentation matches.
//
// For provenance, the media-px calls CM360 produced from these hits are
// recorded in README.md — they are CM360's output, so there is nothing for the
// page's own code to assert about them.

var UUID = '3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a37';

// Captured 2026-09-09, before the ATNID existed. One of six byte-identical
// retries that Chrome issued when the tel: handler dialog interrupted the page.
var HIT_NO_U3 = 'https://ad.doubleclick.net/activity;src=17198395;type=a3iq30;cat=atnid0;rcb=12;ord=5171815678604;npa=0;auiddc=778310522.1788981244;u1=call;u2=test-1788981367895-5;uaa=x86;uab=64;uafvl=Chromium%3B152.0.7977.77%7CNot%253FA_Brand%3B24.0.0.0%7CGoogle%2520Chrome%3B152.0.7977.77;uamb=0;uam=;uap=Windows;uapv=19.0.0;uaw=0;pscdl=noapi;frm=0;_tu=IFA;gtm=45fe6980h2v9254556507za200zd9254556507xec;gcd=13l3l3l3l1l1;dma=0;dc_fmt=3;tag_exp=115938465~115938468~117776795~118897920~118897930~120213116~120385422~120469145~120469153~120914213;epver=2;dc_random=1788981367_8uZsVJT6uTZ7j82Vbof-irFBkqU5ip2Lqw;~oref=https%3A%2F%2Frob-atn.github.io%2Fatnid-testing%2F?';

// Captured 2026-09-10, carrying the ATNID as u3.
var HIT_WITH_U3 = 'https://ad.doubleclick.net/activity;src=17198395;type=a3iq30;cat=atnid0;rcb=4;ord=835058984064;npa=0;auiddc=778310522.1788981244;u1=call;u2=test-1788983043190-2;u3=3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a37;uaa=x86;uab=64;uafvl=Chromium%3B152.0.7977.77%7CNot%253FA_Brand%3B24.0.0.0%7CGoogle%2520Chrome%3B152.0.7977.77;uamb=0;uam=;uap=Windows;uapv=19.0.0;uaw=0;pscdl=noapi;frm=0;_tu=IFA;gtm=45fe6941v9254556507za200zd9254556507xec;gcd=13l3l3l3l1l1;dma=0;dc_fmt=3;tag_exp=115616985~115938466~115938469~117776795~118897920~118897930~120213116~120385423~120469145~120469153~120914213;epver=2;dc_random=1788983043_jNk5sU3xze9j6-buEcb28D-bzzJ-X5MLiw;~oref=https%3A%2F%2Frob-atn.github.io%2Fatnid-testing%2F%3Fatnid%3D3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a37?';

t.section('parsing a real hit');
var p = parseHit(HIT_WITH_U3);
t.check('src', p.src, '17198395');
t.check('type', p.type, 'a3iq30');
t.check('cat', p.cat, 'atnid0');
t.check('u1', p.u1, 'call');
t.check('u2', p.u2, 'test-1788983043190-2');
t.check('u3', p.u3, UUID);
t.check('ord', p.ord, '835058984064');
t.ok('recognised as ours', isFloodlightHit(HIT_WITH_U3, p));
// uafvl carries encoded semicolons (%3B); splitting on raw ';' must not trip.
t.ok('encoded semicolons survive', p.uafvl.indexOf('Chromium') === 0);
t.check('referrer decodes to the landing page',
  decodeURIComponent(p['~oref']),
  'https://rob-atn.github.io/atnid-testing/?atnid=' + UUID);

t.section('replaying the pre-ATNID hit');
land('');
clearLog();
freezeClock(1788981367895);
flSeq = 4;                          // this was the 5th click of its page load
fireFloodlight('call');
t.check('nonce reproduces', newestRow().nonce, 'test-1788981367895-5');
seeResource(HIT_NO_U3);
t.check('paired by u2', newestRow().wire.matchedBy, 'u2');
t.check('five params checked', checkedKeys(newestRow()), 'src,type,cat,u1,u2');
t.check('all verified', mismatches(newestRow()).length, 0);

t.section('duplicate transports of one conversion');
// Chrome issued this same request six times. Identical ord means one
// conversion, and CM360 dedupes on ord — so distinct ord values are what get
// counted, never request count.
for (var i = 0; i < 5; i++) seeResource(HIT_NO_U3);
t.check('still one row', readLog().length, 1);
t.check('one distinct ord', newestRow().wire.ord, '5171815678604');

t.section('replaying the ATNID hit');
land('?atnid=' + UUID);
clearLog();
freezeClock(1788983043190);
flSeq = 1;                          // 2nd click of its page load
fireFloodlight('call');
t.check('page captured the ATNID', newestRow().atnid, UUID);
t.check('nonce reproduces', newestRow().nonce, 'test-1788983043190-2');
seeResource(HIT_WITH_U3);
t.check('six params checked', checkedKeys(newestRow()), 'src,type,cat,u1,u2,u3');
t.check('all verified', mismatches(newestRow()).length, 0);

t.section('the referrer is not a substitute for u3');
// An earlier dynamic tag matched atnid%3D and appeared to work, because the
// encoded landing URL inside ~oref contains it. The literal key never does.
t.check('no literal atnid= in the request', /atnid=/.test(HIT_WITH_U3), false);
t.ok('but the encoded form is present', HIT_WITH_U3.indexOf('atnid%3D') > -1);
// And on a conversion away from the landing page it is not there at all,
// which is exactly where the referrer-scraping tag lost data.
t.check('absent once off the landing page', HIT_NO_U3.indexOf('atnid%3D') > -1, false);
