import { applyTheme, Theme } from "@cloudscape-design/components/theming";

export function applyAwsTheme() {
  const theme: Theme = {
    tokens: {
      fontFamilyBase: "'Amazon Ember','Helvetica Neue',Roboto,Arial,sans-serif",
      colorBackgroundButtonPrimaryDefault: { light: "#ff9900", dark: "#ff9900" },
      colorBackgroundButtonPrimaryHover: { light: "#ffac31", dark: "#ffac31" },
      colorBackgroundButtonPrimaryActive: { light: "#ffb74d", dark: "#ffb74d" },
      colorTextButtonPrimaryDefault: { light: "#0f141a", dark: "#0f141a" },
      colorTextButtonPrimaryHover: { light: "#0f141a", dark: "#0f141a" },
      colorTextButtonPrimaryActive: { light: "#0f141a", dark: "#0f141a" },
      borderRadiusButton: "20px",
      borderRadiusContainer: "16px",
      borderRadiusInput: "8px",
    },
  };
  return applyTheme({ theme });
}
