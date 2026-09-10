// ATNID capture: where the value comes from, what is refused, and how it is
// reflected in the wire check.

var UUID = '3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a37';
var ACT = 'https://ad.doubleclick.net/activity;src=17198395;type=a3iq30;cat=atnid0;ord=99;';

t.section('landing page carries a valid ATNID');
land('?atnid=' + UUID);
t.check('captured', ATNID.value, UUID);
t.check('source named', ATNID.source, 'query string');
t.check('persisted for later pages', sessionStorage.getItem(ATNID_KEY), UUID);
clearLog();
fireFloodlight('call');
t.check('sent as u3', lastGtagParams().u3, UUID);

t.section('uppercase normalises');
land('?atnid=' + UUID.toUpperCase());
t.check('lowercased', ATNID.value, UUID);

t.section('conversion on a later page, param gone');
land('', UUID);
t.check('recovered from session', ATNID.value, UUID);
t.check('source names the session', ATNID.source, 'session (landing page)');
clearLog();
fireFloodlight('website');
t.check('still sent as u3', lastGtagParams().u3, UUID);

t.section('no ATNID anywhere: u3 omitted, not blanked');
land('');
t.check('no value', ATNID.value, null);
clearLog();
fireFloodlight('website');
t.check('u3 absent from params', lastGtagParams().hasOwnProperty('u3'), false);
t.check('u1 still sent', lastGtagParams().u1, 'website');

t.section('hostile query values are refused');
// The Floodlight request is ';'-delimited and the %p macro that forwards this
// to media-px captures up to the next ';', so a crafted value could inject
// key-values into the hit or truncate the forward. None of these may pass.
[
  ['semicolon breaks the Floodlight delimiter', UUID + ';ord=1'],
  ['question mark truncates the %p capture', UUID + '?u1=hacked'],
  ['extra u-var smuggled in', UUID + ';u1=spoofed'],
  ['not a uuid at all', 'hello'],
  ['empty', ''],
  ['one character short', '3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1a3'],
  ['non-hex in a uuid slot', '3f2a9c14-7b8e-4d51-9a6f-0c2e5d8b1zzz'],
  ['script tag', '<script>alert(1)</script>'],
  ['crlf', UUID + '%0d%0aX']
].forEach(function (a) {
  land('?atnid=' + encodeURIComponent(a[1]));
  t.check('refused: ' + a[0], ATNID.value, null);
});

t.section('nothing hostile reaches the tag');
land('?atnid=' + encodeURIComponent(UUID + ';u1=spoofed'));
clearLog();
fireFloodlight('call');
t.check('u3 omitted', lastGtagParams().hasOwnProperty('u3'), false);
t.check('u1 not overridden', lastGtagParams().u1, 'call');
t.check('refusal recorded for the panel', ATNID.rejected, UUID + ';u1=spoofed');

t.section('ATNID among other query params');
land('?utm_source=cm360&atnid=' + UUID + '&utm_medium=display');
t.check('found mid-string', ATNID.value, UUID);
land('?atnid=' + UUID + '#anchor');
t.check('fragment stripped', ATNID.value, UUID);

t.section('wire check covers u3');
land('?atnid=' + UUID);
clearLog();
freezeClock(1788981367895);
flSeq = 0;
fireFloodlight('call');
var n = newestRow().nonce;
seeResource(ACT + 'u1=call;u2=' + n + ';u3=' + UUID + ';uaa=x86?');
t.check('all six params checked', checkedKeys(newestRow()), 'src,type,cat,u1,u2,u3');
t.check('all verified', mismatches(newestRow()).length, 0);

t.section('ATNID sent but stripped before the wire');
clearLog();
flSeq = 0;
fireFloodlight('call');
seeResource(ACT + 'u1=call;u2=' + newestRow().nonce + ';uaa=x86?');
var bad = mismatches(newestRow());
t.check('one mismatch', bad.length, 1);
t.check('names u3', bad[0].key, 'u3');
t.check('reported absent', bad[0].got, null);

t.section('a visit with no ATNID is not penalised');
land('');
clearLog();
flSeq = 0;
fireFloodlight('website');
seeResource(ACT + 'u1=website;u2=' + newestRow().nonce + ';uaa=x86?');
t.check('u3 not among the checks', checkedKeys(newestRow()), 'src,type,cat,u1,u2');
t.check('verdict clean', mismatches(newestRow()).length, 0);
