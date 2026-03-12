// Flag emoji mapping
export const FE = {
  IR:'\u{1F1EE}\u{1F1F7}',KM:'\u{1F1F0}\u{1F1F2}',TG:'\u{1F1F9}\u{1F1EC}',BO:'\u{1F1E7}\u{1F1F4}',KN:'\u{1F1F0}\u{1F1F3}',
  AE:'\u{1F1E6}\u{1F1EA}',PA:'\u{1F1F5}\u{1F1E6}',LR:'\u{1F1F1}\u{1F1F7}',MH:'\u{1F1F2}\u{1F1ED}',SG:'\u{1F1F8}\u{1F1EC}',
  HK:'\u{1F1ED}\u{1F1F0}',CN:'\u{1F1E8}\u{1F1F3}',IN:'\u{1F1EE}\u{1F1F3}',SA:'\u{1F1F8}\u{1F1E6}',BH:'\u{1F1E7}\u{1F1ED}',
  QA:'\u{1F1F6}\u{1F1E6}',KW:'\u{1F1F0}\u{1F1FC}',OM:'\u{1F1F4}\u{1F1F2}',GR:'\u{1F1EC}\u{1F1F7}',PW:'\u{1F1F5}\u{1F1FC}',
  CW:'\u{1F1E8}\u{1F1FC}',BB:'\u{1F1E7}\u{1F1E7}',CK:'\u{1F1E8}\u{1F1F0}',MT:'\u{1F1F2}\u{1F1F9}',GB:'\u{1F1EC}\u{1F1E7}',
  PK:'\u{1F1F5}\u{1F1F0}',BS:'\u{1F1E7}\u{1F1F8}',CY:'\u{1F1E8}\u{1F1FE}',TZ:'\u{1F1F9}\u{1F1FF}'
};

// Flag name mapping
export const FN = {
  IR:'Iran',KM:'Comoros',TG:'Togo',BO:'Bolivia',KN:'St.Kitts',AE:'UAE',PA:'Panama',LR:'Liberia',
  MH:'Marshall Is.',SG:'Singapore',HK:'Hong Kong',CN:'China',IN:'India',SA:'Saudi Arabia',BH:'Bahrain',
  QA:'Qatar',KW:'Kuwait',OM:'Oman',GR:'Greece',PW:'Palau',CW:'Curaçao',BB:'Barbados',CK:'Cook Is.',
  MT:'Malta',GB:'UK',PK:'Pakistan',BS:'Bahamas',CY:'Cyprus',TZ:'Tanzania'
};

// Ship type names
export const TN = {'7':'Cargo','3':'Tug/Special','6':'Passenger','8':'Tanker','2':'Fishing','0':'Unknown','9':'Other','1':'Reserved','4':'HSC'};

// Known FOC registries
export const FOC = new Set(['KM','TG','BO','KN','PW','CW','BB','CK','PA','LR','MH','BS','MT','CY','TZ']);

// Format elapsed seconds as human-readable
export function fmt(s) {
  if (s < 60) return s + 's';
  if (s < 3600) return (s / 60 | 0) + 'm';
  return (s / 3600 | 0) + 'h' + (s % 3600 / 60 | 0) + 'm';
}
