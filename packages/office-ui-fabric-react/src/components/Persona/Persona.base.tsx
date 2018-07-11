import * as React from 'react';
import {
  BaseComponent,
  classNamesFunction,
  customizable,
  divProperties,
  getNativeProps,
  IRenderFunction
} from '../../Utilities';
import { TooltipHost, TooltipOverflowMode, DirectionalHint } from '../../Tooltip';
import { PersonaCoin } from './PersonaCoin/PersonaCoin';
import {
  IPersonaProps,
  IPersonaSharedProps,
  IPersonaStyleProps,
  IPersonaStyles,
  PersonaPresence as PersonaPresenceEnum,
  PersonaSize
} from './Persona.types';

const getClassNames = classNamesFunction<IPersonaStyleProps, IPersonaStyles>();

/**
 * Persona with no default styles.
 * [Use the `styles` API to add your own styles.](https://github.com/OfficeDev/office-ui-fabric-react/wiki/Styling)
 */
@customizable('Persona', ['theme', 'styles'])
export class PersonaBase extends BaseComponent<IPersonaProps, {}> {
  public static defaultProps: IPersonaProps = {
    size: PersonaSize.size48,
    presence: PersonaPresenceEnum.none,
    imageAlt: ''
  };

  constructor(props: IPersonaProps) {
    super(props);

    this._warnDeprecations({ primaryText: 'text' });
  }

  public render(): JSX.Element {
    const size = this.props.size as PersonaSize;

    // These properties are to be explicitly passed into PersonaCoin because they are the only props directly used
    const {
      allowPhoneInitials,
      className,
      coinProps,
      showUnknownPersonaCoin,
      coinSize,
      styles,
      imageAlt,
      imageInitials,
      imageShouldFadeIn,
      imageShouldStartVisible,
      imageUrl,
      initialsColor,
      onPhotoLoadingStateChange,
      onRenderCoin,
      onRenderInitials,
      presence,
      showSecondaryText,
      theme
    } = this.props;

    const personaCoinProps: IPersonaSharedProps = {
      allowPhoneInitials,
      coinProps,
      showUnknownPersonaCoin,
      coinSize,
      imageAlt,
      imageInitials,
      imageShouldFadeIn,
      imageShouldStartVisible,
      imageUrl,
      initialsColor,
      onPhotoLoadingStateChange,
      onRenderCoin,
      onRenderInitials,
      presence,
      size,
      text: this._getText()
    };

    const classNames = getClassNames(styles, {
      theme: theme!,
      className,
      showSecondaryText,
      presence,
      size
    });

    // construct default render behavior for each text prop seperately.
    const _onRenderPrimaryText = this._onRenderText(this._getText()),
      _onRenderSecondaryText = this._onRenderText(this.props.secondaryText),
      _onRenderTertiaryText = this._onRenderText(this.props.tertiaryText),
      _onRenderOptionalText = this._onRenderText(this.props.optionalText);

    const {
      hidePersonaDetails,
      onRenderPrimaryText = _onRenderPrimaryText,
      onRenderSecondaryText = _onRenderSecondaryText,
      onRenderTertiaryText = _onRenderTertiaryText,
      onRenderOptionalText = _onRenderOptionalText
    } = this.props;

    const personaDetails = (
      <div className={classNames.details}>
        <div className={classNames.primaryText}>
          {onRenderPrimaryText && onRenderPrimaryText(this.props, _onRenderPrimaryText)}
        </div>
        <div className={classNames.secondaryText}>
          {onRenderSecondaryText && onRenderSecondaryText(this.props, _onRenderSecondaryText)}
        </div>
        <div className={classNames.tertiaryText}>
          {onRenderTertiaryText && onRenderTertiaryText(this.props, _onRenderTertiaryText)}
        </div>
        <div className={classNames.optionalText}>
          {onRenderOptionalText && onRenderOptionalText(this.props, _onRenderOptionalText)}
        </div>
        {this.props.children}
      </div>
    );

    const divProps = getNativeProps(this.props, divProperties);

    return (
      <div
        {...divProps}
        className={classNames.root}
        style={coinSize ? { height: coinSize, minWidth: coinSize } : undefined}
      >
        <PersonaCoin {...personaCoinProps} />
        {(!hidePersonaDetails || (size === PersonaSize.size10 || size === PersonaSize.tiny)) && personaDetails}
      </div>
    );
  }

  /**
   * Deprecation helper for getting text.
   */
  private _getText(): string {
    return this.props.text || this.props.primaryText || '';
  }

  /**
   * constructs a default RenderFunction for text properties
   * @param text
   * @param className
   */
  private _onRenderText(text: string | undefined): IRenderFunction<IPersonaProps> | undefined {
    const textRenderFunction = (props: IPersonaProps): JSX.Element => {
      return (
        <TooltipHost
          content={text}
          overflowMode={TooltipOverflowMode.Parent}
          directionalHint={DirectionalHint.topLeftEdge}
        >
          {text}
        </TooltipHost>
      );
    };

    return text ? textRenderFunction : undefined;
  }
}
