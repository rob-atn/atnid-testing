// The fire log and the wire check: pairing hits to clicks, rejecting noise,
// and the failure paths that matter more than the happy one.

var BASE = ';dc_lat=;dc_rdid=;tag_for_child_directed_treatment=;tfua=;npa=;gdpr=;gdpr_consent=';
var DDM = 'https://ad.doubleclick.net/ddm/activity/src=17198395;type=a3iq30;cat=atnid0';
var FLS = 'https://17198395.fls.doubleclick.net/activityi;src=17198395;type=a3iq30;cat=atnid0';
var ACT = 'https://ad.doubleclick.net/activity;src=17198395;type=a3iq30;cat=atnid0';

t.section('complete hit, /ddm/activity/ shape');
land('');
clearLog();
fireFloodlight('call');
var n1 = newestRow().nonce;
seeResource(DDM + BASE + ';ord=8675309;num=1;u1=call;u2=' + n1 + '?');
t.check('verified', mismatches(newestRow()).length, 0);
t.check('paired by u2', newestRow().wire.matchedBy, 'u2');
t.check('ord captured', newestRow().wire.ord, '8675309');

t.section('complete hit, <id>.fls.doubleclick.net/activityi shape');
clearLog();
fireFloodlight('website');
var n2 = newestRow().nonce;
seeResource(FLS + BASE + ';ord=1122334;u1=website;u2=' + n2 + '?');
t.check('verified', mismatches(newestRow()).length, 0);

t.section('complete hit, /activity;src= shape (what production actually uses)');
clearLog();
fireFloodlight('call');
var n2b = newestRow().nonce;
seeResource(ACT + ';ord=555;u1=call;u2=' + n2b + '?');
t.check('verified', mismatches(newestRow()).length, 0);

t.section('a u-var stripped before it reached the wire');
clearLog();
fireFloodlight('call');
var n3 = newestRow().nonce;
seeResource(DDM + BASE + ';ord=42;u2=' + n3 + '?');
var bad = mismatches(newestRow());
t.check('one mismatch', bad.length, 1);
t.check('names u1', bad[0].key, 'u1');
t.check('reported absent', bad[0].got, null);

t.section('no u2 on the wire, so pairing falls back to timing');
clearLog();
fireFloodlight('call');
seeResource(DDM + BASE + ';ord=7;u1=call?');
t.ok('still attached', newestRow().wire !== null);
t.check('flagged as a guess', newestRow().wire.matchedBy, 'fallback');
t.check('u2 reported absent', mismatches(newestRow())[0].key, 'u2');

t.section('noise is ignored');
clearLog();
fireFloodlight('call');
seeResource('https://www.googletagmanager.com/gtag/js?id=DC-17198395');
seeResource('https://fonts.googleapis.com/css2?family=Inter');
seeResource('https://ad.doubleclick.net/ddm/activity/src=99999999;type=zzz;cat=other;ord=1?');
t.check('left untouched', newestRow().wire, null);

t.section('two clicks whose hits arrive out of order');
clearLog();
fireFloodlight('call');
var a = newestRow().nonce;
fireFloodlight('website');
var b = newestRow().nonce;
seeResource(DDM + ';ord=2;u1=website;u2=' + b + '?');   // second click lands first
seeResource(DDM + ';ord=1;u1=call;u2=' + a + '?');
var byNonce = {};
readLog().forEach(function (r) {
  byNonce[r.nonce] = r.wire ? mismatches(r).length : -1;
});
t.check('call row clean', byNonce[a], 0);
t.check('website row clean', byNonce[b], 0);
t.ok('both paired by u2', readLog().every(function (r) { return r.wire.matchedBy === 'u2'; }));

t.section('nonce collisions inside one millisecond');
clearLog();
freezeClock(1700000000000);
flSeq = 0;
for (var i = 0; i < 5; i++) fireFloodlight('call');
var nonces = readLog().map(function (r) { return r.nonce; });
t.check('five rows', nonces.length, 5);
t.check('all unique', new Set(nonces).size, 5);
markConfirmed(nonces[2]);
t.check('exactly one confirmed', readLog().filter(function (r) { return r.confirmed; }).length, 1);
t.check('and it is the right one', readLog().filter(function (r) { return r.confirmed; })[0].nonce, nonces[2]);

t.section('a row left over from an earlier page load');
clearLog();
flSeq = 0;
fireFloodlight('call');
var rows = readLog();
rows[0].load = 'L-an-older-load';        // as if it survived a reload
writeLog(rows);
seeResource(DDM + ';ord=3;u1=call?');    // no u2, so only fallback could claim it
t.check('stale row not claimed', newestRow().wire, null);

t.section('callback and rendering');
clearLog();
flSeq = 0;
fireFloodlight('call');
var params = lastGtagParams();
t.check('send_to', params.send_to, FL_SEND_TO);
t.ok('event_callback supplied', typeof params.event_callback === 'function');
t.check('starts unconfirmed', newestRow().confirmed, false);
params.event_callback();
t.check('callback confirms', newestRow().confirmed, true);
seeResource(DDM + ';ord=9;u1=call;u2=' + newestRow().nonce + '?');
t.ok('verified marker painted', /&#10003; verified/.test(painted()));
t.ok('detail row present', /class="detail"/.test(painted()));
t.ok('detail hidden by default', /class="detail" data-for="[^"]+" hidden/.test(painted()));
t.ok('raw url painted', painted().indexOf('ord=9') > -1);

t.section('empty state');
clearLog();
t.ok('empty state shown', /No conversions fired yet/.test(painted()));

t.section('escaping — the panel paints observed request data');
clearLog();
fireFloodlight('call');
var hostile = readLog();
hostile[0].action = '<img src=x onerror=alert(1)>';
writeLog(hostile);
render();
t.ok('markup escaped', /&lt;img src=x/.test(painted()));
t.ok('no live tag emitted', painted().indexOf('<img') === -1);
