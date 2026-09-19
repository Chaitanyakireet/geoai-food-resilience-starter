// Well-known Hyderabad-area localities that are NOT their own mandal in
// the ingested administrative dataset -- they sit inside a real mandal's
// boundary, so searching for them resolves to that mandal rather than a
// (nonexistent) locality-specific polygon. Every entry here is a place
// this session verified against the real /gis/mandals data before adding
// it; the resolution is always disclosed in the search result and in
// Location Intelligence via "resolved_via", never presented as if the
// locality had its own independently-measured boundary or risk figure.
//
// Deliberately NOT exhaustive: a name is only added once its containing
// mandal has been confirmed against real data. (Bowenpally, for example,
// is a well-known Secunderabad-area locality but wasn't added because its
// exact mandal wasn't confirmed against the dataset in this pass.)
export type LocalityAlias = {
  name: string;
  districtId: string;
  mandalId: string;
};

export const LOCALITY_ALIASES: LocalityAlias[] = [
  { name: "Hitech City", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
  { name: "HITEC City", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
  { name: "Gachibowli", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
  { name: "Madhapur", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
  { name: "Kondapur", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
  { name: "Nanakramguda", districtId: "ranga_reddy", mandalId: "serilingampalle_mandal_9832843" },
];
