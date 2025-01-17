import { ButtonBase } from './button-common';
import { PseudoClassHandler } from '../core/view';
import { paddingLeftProperty, paddingTopProperty, paddingRightProperty, paddingBottomProperty, Length, zIndexProperty, minWidthProperty, minHeightProperty } from '../styling/style-properties';
import { textAlignmentProperty } from '../text-base';
import { CoreTypes } from '../../core-types';
import { profile } from '../../profiling';
import { TouchGestureEventData, GestureTypes, TouchAction } from '../gestures';
import { Device } from '../../platform';
import lazy from '../../utils/lazy';
import type { Background } from 'ui/styling/background';

export * from './button-common';

const sdkVersion = lazy(() => parseInt(Device.sdkVersion));

interface ClickListener {
	new (owner: Button): android.view.View.OnClickListener;
}

let ClickListener: ClickListener;
let APILEVEL: number;
let AndroidButton: typeof android.widget.Button;

function initializeClickListener(): void {
	if (ClickListener) {
		return;
	}

	@NativeClass
	@Interfaces([android.view.View.OnClickListener])
	class ClickListenerImpl extends java.lang.Object implements android.view.View.OnClickListener {
		constructor(public owner: Button) {
			super();

			return global.__native(this);
		}

		public onClick(v: android.view.View): void {
			const owner = this.owner;
			if (owner) {
				owner._emit(ButtonBase.tapEvent);
			}
		}
	}

	ClickListener = ClickListenerImpl;
}

export class Button extends ButtonBase {
	nativeViewProtected: android.widget.Button;

	constructor() {
		super();
		if (!APILEVEL) {
			APILEVEL = android.os.Build.VERSION.SDK_INT;
		}
	}

	private _stateListAnimator: any;
	private _highlightedHandler: (args: TouchGestureEventData) => void;

	public _applyBackground(background: Background, isBorderDrawable, onlyColor: boolean, backgroundDrawable: any) {
		const nativeView = this.nativeViewProtected;
		if (backgroundDrawable && onlyColor) {
			if (isBorderDrawable && (<any>nativeView)._cachedDrawable) {
				backgroundDrawable = (<any>nativeView)._cachedDrawable;
				// we need to duplicate the drawable or we lose the "default" cached drawable
				const constantState = backgroundDrawable.getConstantState();
				if (constantState) {
					try {
						backgroundDrawable = constantState.newDrawable(nativeView.getResources());
						// eslint-disable-next-line no-empty
					} catch {}
				}
				nativeView.setBackground(backgroundDrawable);
			}

			const backgroundColor = ((<any>backgroundDrawable).backgroundColor = background.color.android);
			backgroundDrawable.mutate();
			backgroundDrawable.setColorFilter(backgroundColor, android.graphics.PorterDuff.Mode.SRC_IN);
			backgroundDrawable.invalidateSelf(); // Make sure the drawable is invalidated. Android forgets to invalidate it in some cases: toolbar
			(<any>backgroundDrawable).backgroundColor = backgroundColor;
		} else {
			super._applyBackground(background, isBorderDrawable, onlyColor, backgroundDrawable);
		}
	}

	@profile
	public createNativeView() {
		if (!AndroidButton) {
			AndroidButton = android.widget.Button;
		}

		return new AndroidButton(this._context);
	}

	public initNativeView(): void {
		super.initNativeView();
		const nativeView = this.nativeViewProtected;
		initializeClickListener();
		const clickListener = new ClickListener(this);
		nativeView.setOnClickListener(clickListener);
		(<any>nativeView).clickListener = clickListener;
	}

	public disposeNativeView() {
		if (this.nativeViewProtected) {
			(<any>this.nativeViewProtected).clickListener.owner = null;
		}
		super.disposeNativeView();
	}

	public resetNativeView(): void {
		super.resetNativeView();

		if (this._stateListAnimator && APILEVEL >= 21) {
			(<any>this.nativeViewProtected).setStateListAnimator(this._stateListAnimator);
			this._stateListAnimator = undefined;
		}
	}

	@PseudoClassHandler('normal', 'highlighted', 'pressed', 'active')
	_updateButtonStateChangeHandler(subscribe: boolean) {
		if (subscribe) {
			this._highlightedHandler =
				this._highlightedHandler ||
				((args: TouchGestureEventData) => {
					switch (args.action) {
						case TouchAction.up:
						case TouchAction.cancel:
							this._goToVisualState('normal');
							break;
						case TouchAction.down:
							this._goToVisualState('highlighted');
							break;
					}
				});
			this.on(GestureTypes.touch, this._highlightedHandler);
		} else {
			this.off(GestureTypes.touch, this._highlightedHandler);
		}
	}

	[minWidthProperty.getDefault](): CoreTypes.LengthType {
		const dips = org.nativescript.widgets.ViewHelper.getMinWidth(this.nativeViewProtected);

		return { value: dips, unit: 'px' };
	}

	[minHeightProperty.getDefault](): CoreTypes.LengthType {
		const dips = org.nativescript.widgets.ViewHelper.getMinHeight(this.nativeViewProtected);

		return { value: dips, unit: 'px' };
	}

	[paddingTopProperty.getDefault](): CoreTypes.LengthType {
		return { value: this._defaultPaddingTop, unit: 'px' };
	}
	[paddingTopProperty.setNative](value: CoreTypes.LengthType) {
		org.nativescript.widgets.ViewHelper.setPaddingTop(this.nativeViewProtected, Length.toDevicePixels(value, 0) + Length.toDevicePixels(this.style.borderTopWidth, 0));
	}

	[paddingRightProperty.getDefault](): CoreTypes.LengthType {
		return { value: this._defaultPaddingRight, unit: 'px' };
	}
	[paddingRightProperty.setNative](value: CoreTypes.LengthType) {
		org.nativescript.widgets.ViewHelper.setPaddingRight(this.nativeViewProtected, Length.toDevicePixels(value, 0) + Length.toDevicePixels(this.style.borderRightWidth, 0));
	}

	[paddingBottomProperty.getDefault](): CoreTypes.LengthType {
		return { value: this._defaultPaddingBottom, unit: 'px' };
	}
	[paddingBottomProperty.setNative](value: CoreTypes.LengthType) {
		org.nativescript.widgets.ViewHelper.setPaddingBottom(this.nativeViewProtected, Length.toDevicePixels(value, 0) + Length.toDevicePixels(this.style.borderBottomWidth, 0));
	}

	[paddingLeftProperty.getDefault](): CoreTypes.LengthType {
		return { value: this._defaultPaddingLeft, unit: 'px' };
	}
	[paddingLeftProperty.setNative](value: CoreTypes.LengthType) {
		org.nativescript.widgets.ViewHelper.setPaddingLeft(this.nativeViewProtected, Length.toDevicePixels(value, 0) + Length.toDevicePixels(this.style.borderLeftWidth, 0));
	}

	[zIndexProperty.setNative](value: number) {
		// API >= 21
		if (APILEVEL >= 21) {
			const nativeView = this.nativeViewProtected;
			if (!this._stateListAnimator) {
				this._stateListAnimator = (<any>nativeView).getStateListAnimator();
			}
			(<any>nativeView).setStateListAnimator(null);
		}

		org.nativescript.widgets.ViewHelper.setZIndex(this.nativeViewProtected, value);
	}

	[textAlignmentProperty.setNative](value: CoreTypes.TextAlignmentType) {
		// Button initial value is center.
		const newValue = value === 'initial' ? 'center' : value;
		super[textAlignmentProperty.setNative](newValue);
	}

	protected getDefaultElevation(): number {
		if (sdkVersion() < 21) {
			return 0;
		}

		// NOTE: Button widget has StateListAnimator that defines the elevation value and
		// at the time of the getDefault() query the animator is not applied yet so we
		// return the hardcoded @dimen/button_elevation_material value 2dp here instead
		return 2;
	}

	protected getDefaultDynamicElevationOffset(): number {
		if (sdkVersion() < 21) {
			return 0;
		}

		return 4; // 4dp @dimen/button_pressed_z_material
	}
}

Button.prototype._ignoreFlexMinWidthHeightReset = true;
