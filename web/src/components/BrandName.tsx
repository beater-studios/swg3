// Site name as in the logo: the trailing number always in the Fire color, ignoring theme and accent.

import { BRAND_NAME } from "../brand";

const [, TEXT, NUMBER] = BRAND_NAME.match(/^(.*?)(\d*)$/)!;

export function BrandName() {
  return <>{TEXT}{NUMBER && <span className="brand-num">{NUMBER}</span>}</>;
}
