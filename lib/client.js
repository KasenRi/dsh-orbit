window.__ModuleLoader__.load({
	id: "@kasenri/dsh-orbit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region client/model-options.ts
		/** Find one catalog model for a stored route. */
		function modelOf(state, route) {
			if (route === void 0) return void 0;
			for (const group of state.groups) {
				if (group.id !== route.provider) continue;
				for (const model of group.models) if (model.id === route.model) return model;
			}
		}
		/**
		* Effort options for one model: exactly the DSH model metadata's explicit
		* `reasoning.efforts`. A model without reasoning metadata yields none; the
		* picker then offers only Provider default.
		*/
		function effortsOf(model) {
			return (model?.reasoning?.efforts ?? []).map((effort) => ({
				id: effort.id,
				name: effort.name
			}));
		}
		/** Human effort label for a stored effort id; falls back to the raw id. */
		function effortLabelOf(model, effort) {
			if (effort === void 0 || effort === "") return void 0;
			const explicit = model?.reasoning?.efforts.find((entry) => entry.id === effort);
			if (explicit !== void 0) return explicit.name;
			return effort;
		}
		/** Display name for a stored route: catalog name, then its model id. */
		function routeLabelOf(state, route) {
			if (route === void 0) return void 0;
			return modelOf(state, route)?.name ?? route.model;
		}
		/**
		* Route for a freshly picked model: no reasoning effort is adopted, not even
		* the catalog metadata's `defaultEffort`. Provider default means the absent
		* effort, and a previous model's effort is never inherited.
		*/
		function routeForModel(provider, model) {
			return {
				provider,
				model: model.id
			};
		}
		/**
		* Effort rows for one model: Provider default (an undefined effort) first,
		* then the model's explicit metadata efforts, if any.
		*/
		function effortChoicesOf(model, providerDefaultLabel) {
			return [{
				id: "provider-default",
				label: providerDefaultLabel,
				effort: void 0
			}, ...effortsOf(model).map((effort) => ({
				id: `effort:${effort.id}`,
				label: effort.name,
				effort: effort.id
			}))];
		}
		/** Normalize one settings wire value into a complete route. */
		function routeFromSettingsValue(value) {
			if (value === null || typeof value !== "object") return void 0;
			const record = value;
			const provider = record["provider"];
			const model = record["model"];
			if (typeof provider !== "string" || provider === "") return void 0;
			if (typeof model !== "string" || model === "") return void 0;
			const reasoningEffort = record["reasoningEffort"];
			return {
				provider,
				model,
				...typeof reasoningEffort === "string" && reasoningEffort !== "" ? { reasoningEffort } : {}
			};
		}
		//#endregion
		//#region \0dsh-css:/root/code/dsh-pi-parity/packages/orbit/client/OrbitModelSelect.module.css.mjs
		const css = ".f77nca_panel{z-index:60;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-menu);min-width:260px;max-width:420px;max-height:min(55vh,420px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:6px;font-size:13px;line-height:1.4;display:flex;position:fixed;overflow:auto}.f77nca_title{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;padding:6px 8px 2px;font-size:11px;overflow:hidden}.f77nca_group{color:var(--dsw-alias-label-tertiary);padding:8px 8px 2px;font-size:11px}.f77nca_row{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;align-items:center;gap:8px;padding:7px 8px;display:flex}.f77nca_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.f77nca_switchRow{align-items:center;gap:8px;padding:4px 8px 6px;display:flex}.f77nca_switchControl{margin-left:auto}.f77nca_rowLabel{flex:none}.f77nca_rowValue{max-width:190px;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;margin-left:auto;overflow:hidden}.f77nca_rowValueActive{color:var(--dsw-alias-label-primary)}.f77nca_rowDetail{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px}.f77nca_check{color:var(--dsw-alias-state-business-primary);flex:none;margin-left:6px}.f77nca_chevron{color:var(--dsw-alias-label-tertiary);flex:none;margin-left:6px}.f77nca_separator{background:var(--dsw-alias-border-l1);height:1px;margin:6px 4px}.f77nca_hint{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:11px}.f77nca_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:8px;padding:8px;font-size:12px;display:flex}.f77nca_back{width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:6px 8px 8px;font-size:12px;display:flex}";
		const tagId = "@kasenri/dsh-orbit/OrbitModelSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@kasenri/dsh-orbit";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var OrbitModelSelect_module_css_default = {
			"check": "f77nca_check",
			"chevron": "f77nca_chevron",
			"rowDetail": "f77nca_rowDetail",
			"title": "f77nca_title",
			"separator": "f77nca_separator",
			"row": "f77nca_row",
			"group": "f77nca_group",
			"panel": "f77nca_panel",
			"rowLabel": "f77nca_rowLabel",
			"rowValue": "f77nca_rowValue",
			"hint": "f77nca_hint",
			"back": "f77nca_back",
			"switchControl": "f77nca_switchControl",
			"switchRow": "f77nca_switchRow",
			"error": "f77nca_error",
			"rowValueActive": "f77nca_rowValueActive"
		};
		//#endregion
		//#region client/OrbitModelSelect.tsx
		/**
		* OrbitModelSelect: the compact Orbit model control registered as a list entry
		* before the native composer model seat.
		*
		* Root: Commander / Executor / Watchdog current values. Commander and Watchdog
		* pick from the shared catalog and persist into the `orbit` settings
		* namespace; the Executor picks through the SAME per-session ModelDirectory the
		* native seat uses, so the two controls are one state.
		*/
		const CHEVRON = "›";
		const CARET = "▾";
		const BACK = "‹";
		/** Design cap for the panel; the anchored clamp only ever lowers it. */
		const PANEL_MAX_HEIGHT = 420;
		/**
		* Hidden but laid-out first paint: the panel must be measurable before the
		* anchored position is known, otherwise it would be placed with height 0 and
		* grow downward off the trigger.
		*/
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* Render the Orbit model control.
		* @param props - injected directory/settings faces plus the locale seat.
		* @returns the trigger and, while open, the panel.
		*/
		function OrbitModelSelect({ t, available, directory, settings, loadModels, selectModel, writeRole, setOrbitEnabled, reloadSettings, useProjection }) {
			const dir = (0, react.useSyncExternalStore)((listener) => directory.subscribe(listener), () => directory.getSnapshot());
			const config = (0, react.useSyncExternalStore)((listener) => settings.subscribe(listener), () => settings.getSnapshot());
			const orbitSession = useProjection("orbitSession");
			const [orbitOverride, setOrbitOverride] = (0, react.useState)(null);
			const [orbitPending, setOrbitPending] = (0, react.useState)(false);
			const orbitEnabled = orbitOverride ?? orbitSession?.enabled === true;
			(0, react.useEffect)(() => {
				if (orbitOverride !== null && orbitSession?.enabled === orbitOverride) setOrbitOverride(null);
			}, [orbitOverride, orbitSession?.enabled]);
			const toggleOrbit = async (next) => {
				setOrbitOverride(next);
				setOrbitPending(true);
				const ok = await setOrbitEnabled(next);
				setOrbitPending(false);
				if (!ok) setOrbitOverride(null);
			};
			const [open, setOpen] = (0, react.useState)(false);
			const [pane, setPane] = (0, react.useState)({ kind: "root" });
			const [busy, setBusy] = (0, react.useState)(false);
			const submitting = (0, react.useRef)(false);
			const triggerRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: triggerRef,
				panelRef,
				side: "top",
				gap: 8,
				margin: 12
			});
			const maxHeight = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredMaxHeight)(panelRef, PANEL_MAX_HEIGHT, position);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(triggerRef, open, setOpen, panelRef);
			(0, react.useEffect)(() => {
				if (open) loadModels();
			}, [open, loadModels]);
			(0, react.useEffect)(() => {
				if (!open) setPane({ kind: "root" });
			}, [open]);
			if (!available) return null;
			const commanderRoute = config.commander;
			const commanderModel = modelOf(dir, commanderRoute);
			const commanderLabel = commanderRoute === void 0 ? t("triggerFallback") : routeLabelOf(dir, commanderRoute) ?? commanderRoute.model;
			const commanderEffort = effortLabelOf(commanderModel, commanderRoute?.reasoningEffort);
			const executorRoute = dir.current === null ? void 0 : {
				provider: dir.current.provider,
				model: dir.current.model,
				...dir.current.reasoningEffort === void 0 ? {} : { reasoningEffort: dir.current.reasoningEffort }
			};
			const executorModel = modelOf(dir, executorRoute);
			const executorLabel = executorRoute === void 0 ? void 0 : routeLabelOf(dir, executorRoute) ?? executorRoute.model;
			const executorEffort = effortLabelOf(executorModel, executorRoute?.reasoningEffort);
			const watchdogRoute = config.watchdog;
			const watchdogModel = modelOf(dir, watchdogRoute);
			const watchdogLabel = watchdogRoute === void 0 ? void 0 : routeLabelOf(dir, watchdogRoute) ?? watchdogRoute.model;
			const watchdogEffort = effortLabelOf(watchdogModel, watchdogRoute?.reasoningEffort);
			const commitRole = async (role, route) => {
				if (submitting.current || config.status !== "ready") return;
				submitting.current = true;
				setBusy(true);
				try {
					if (await writeRole(role, route)) setOpen(false);
				} finally {
					submitting.current = false;
					setBusy(false);
				}
			};
			const commitExecutor = async (selection) => {
				if (submitting.current) return;
				submitting.current = true;
				setBusy(true);
				try {
					if (await selectModel(selection)) setOpen(false);
				} finally {
					submitting.current = false;
					setBusy(false);
				}
			};
			const currentRouteOf = (role) => role === "commander" ? config.commander : role === "watchdog" ? config.watchdog : executorRoute;
			const roleLabelOf = (role) => role === "commander" ? commanderLabel : role === "watchdog" ? watchdogLabel : executorLabel;
			const roleModelLabelOf = (role) => t(role === "commander" ? "commanderModel" : role === "executor" ? "executorModel" : "watchdogModel");
			const roleEffortLabelOf = (role) => role === "commander" ? commanderEffort : role === "watchdog" ? watchdogEffort : executorEffort;
			const commitEffort = async (role, route, effort) => {
				const next = {
					provider: route.provider,
					model: route.model,
					...effort === void 0 ? {} : { reasoningEffort: effort }
				};
				if (role === "executor") {
					await commitExecutor(next);
					return;
				}
				await commitRole(role, next);
			};
			const modelRow = (role, provider, providerName, model) => {
				const current = currentRouteOf(role);
				const active = current?.provider === provider && current.model === model.id;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "menuitem",
					className: OrbitModelSelect_module_css_default.row,
					disabled: busy,
					onClick: () => {
						setPane({
							kind: "efforts",
							role,
							draft: routeForModel(provider, model)
						});
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: OrbitModelSelect_module_css_default.rowLabel,
						children: [model.name, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: OrbitModelSelect_module_css_default.rowDetail,
							children: [" ", providerName]
						})]
					}), active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: OrbitModelSelect_module_css_default.check,
						children: "✓"
					}) : null]
				}, `${provider}/${model.id}`);
			};
			const effortPaneRoute = pane.kind === "efforts" ? pane.draft ?? currentRouteOf(pane.role) : void 0;
			const effortPaneModel = modelOf(dir, effortPaneRoute);
			const effortPaneChoices = pane.kind === "efforts" ? effortChoicesOf(effortPaneModel, t("providerDefault")) : [];
			const settingsError = config.error;
			const modelError = dir.status === "error" ? dir.error ?? t("loadFailed") : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				ref: triggerRef,
				style: { display: "inline-flex" },
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					size: "sm",
					title: t("tooltip"),
					disabled: busy,
					onClick: () => {
						setOpen((value) => !value);
					},
					children: [
						orbitEnabled ? commanderLabel : t("orbitOff"),
						orbitEnabled && commanderEffort !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { color: "var(--dsw-alias-label-tertiary)" },
							children: ` ${commanderEffort}`
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: OrbitModelSelect_module_css_default.chevron,
							children: CARET
						})
					]
				})
			}), open ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				className: OrbitModelSelect_module_css_default.panel,
				style: {
					...position ?? MEASURE_STYLE,
					maxHeight
				},
				role: "menu",
				children: [
					pane.kind === "root" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.title,
						children: t("title")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: OrbitModelSelect_module_css_default.back,
						onClick: () => {
							setPane(pane.kind === "role" ? { kind: "root" } : {
								kind: "role",
								role: pane.role
							});
						},
						children: `${BACK} ${pane.kind === "role" ? t("back") : t(pane.role)}`
					}),
					settingsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OrbitModelSelect_module_css_default.error,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${t("settingsFailed")}: ${settingsError}` }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: () => {
								reloadSettings();
							},
							children: t("retry")
						})]
					}),
					modelError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: OrbitModelSelect_module_css_default.error,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: modelError }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: () => {
								loadModels();
							},
							children: t("retry")
						})]
					}),
					pane.kind === "root" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: OrbitModelSelect_module_css_default.switchRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: OrbitModelSelect_module_css_default.rowLabel,
								children: t("enableLongRun")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
								className: OrbitModelSelect_module_css_default.switchControl,
								checked: orbitEnabled,
								disabled: orbitPending,
								label: t("orbitSwitchLabel"),
								onChange: (next) => {
									toggleOrbit(next);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: OrbitModelSelect_module_css_default.separator }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "role",
									role: "commander"
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowLabel,
									children: t("commander")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: OrbitModelSelect_module_css_default.rowValue,
									children: [commanderLabel, commanderEffort === void 0 ? "" : ` · ${commanderEffort}`]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.chevron,
									children: CHEVRON
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "role",
									role: "executor"
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowLabel,
									children: t("executor")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: OrbitModelSelect_module_css_default.rowValue,
									children: [executorLabel ?? t("triggerFallback"), executorEffort === void 0 ? "" : ` · ${executorEffort}`]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowDetail,
									children: t("followsSession")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.chevron,
									children: CHEVRON
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "role",
									role: "watchdog"
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowLabel,
									children: t("watchdog")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: OrbitModelSelect_module_css_default.rowValue,
									children: [watchdogLabel ?? t("triggerFallback"), watchdogEffort === void 0 ? "" : ` · ${watchdogEffort}`]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.chevron,
									children: CHEVRON
								})
							]
						})
					] }) : null,
					pane.kind === "role" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "models",
									role: pane.role
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowLabel,
									children: roleModelLabelOf(pane.role)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowValue,
									children: roleLabelOf(pane.role) ?? t("triggerFallback")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.chevron,
									children: CHEVRON
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "efforts",
									role: pane.role
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowLabel,
									children: t("effort")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.rowValue,
									children: roleEffortLabelOf(pane.role) ?? t("providerDefault")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: OrbitModelSelect_module_css_default.chevron,
									children: CHEVRON
								})
							]
						}),
						pane.role === "executor" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: OrbitModelSelect_module_css_default.hint,
							children: t("followsSession")
						}) : null
					] }) : null,
					pane.kind === "models" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: OrbitModelSelect_module_css_default.group,
							children: t("models")
						}),
						dir.groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: OrbitModelSelect_module_css_default.group,
							children: group.name
						}), group.models.map((model) => modelRow(pane.role, group.id, group.name, model))] }, group.id)),
						dir.failures.map((failure) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: OrbitModelSelect_module_css_default.error,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: `${failure.name}: ${failure.message}` })
						}, failure.id))
					] }) : null,
					pane.kind === "efforts" && effortPaneRoute !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.group,
						children: t("effort")
					}), effortPaneChoices.map((choice) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "menuitem",
						className: OrbitModelSelect_module_css_default.row,
						disabled: busy,
						onClick: () => {
							commitEffort(pane.role, effortPaneRoute, choice.effort);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: OrbitModelSelect_module_css_default.rowLabel,
							children: choice.label
						}), pane.draft === void 0 && effortPaneRoute.reasoningEffort === choice.effort ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: OrbitModelSelect_module_css_default.check,
							children: "✓"
						}) : null]
					}, choice.id))] }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: OrbitModelSelect_module_css_default.separator }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.hint,
						children: t("applyOnNextSend")
					})
				]
			}), document.body) : null] });
		}
		//#endregion
		//#region client/locales.ts
		const NS = "orbit-model";
		/** English strings (the key-set source of truth for this pair). */
		const en = {
			triggerFallback: "Not configured",
			tooltip: "Orbit model configuration",
			title: "Orbit — Self-reviewing continuous execution",
			enableLongRun: "Enable long-running execution",
			orbitOff: "Orbit Off",
			orbitSwitchLabel: "Orbit for this chat",
			commander: "Commander",
			executor: "Executor",
			watchdog: "Watchdog",
			commanderModel: "Commander model",
			executorModel: "Executor model",
			watchdogModel: "Watchdog model",
			followsSession: "Follows current session model",
			models: "Model",
			effort: "Reasoning effort",
			providerDefault: "Provider default",
			back: "Back",
			retry: "Retry",
			loadFailed: "Failed to load models",
			settingsFailed: "Failed to load Orbit settings",
			saveFailed: "Failed to save Orbit settings",
			applyOnNextSend: "Changes apply to the next message"
		};
		/** Chinese strings. */
		const zh = {
			triggerFallback: "未配置",
			tooltip: "Orbit 模型配置",
			title: "Orbit 让AI自我审核连续执行",
			enableLongRun: "启用一键长执行",
			orbitOff: "Orbit Off",
			orbitSwitchLabel: "本会话 Orbit 开关",
			commander: "指挥官",
			executor: "执行员",
			watchdog: "监控模型",
			commanderModel: "指挥官模型",
			executorModel: "执行员模型",
			watchdogModel: "监控模型",
			followsSession: "跟随当前会话模型",
			models: "模型",
			effort: "推理等级",
			providerDefault: "提供方默认",
			back: "返回",
			retry: "重试",
			loadFailed: "模型列表加载失败",
			settingsFailed: "Orbit 设置加载失败",
			saveFailed: "Orbit 设置保存失败",
			applyOnNextSend: "更改将会在下一次发送时生效"
		};
		//#endregion
		//#region client/index.ts
		/** The host settings namespace Orbit registers for its own two roles. */
		const ORBIT_SETTINGS_NS = "orbit";
		/**
		* Keep Orbit as the final list entry in `conversation.input.right`.
		* DSH renders the whole right list before the named model seat, so this gives
		* the stable local order: other right-side controls → Orbit → model selector.
		*/
		const ORBIT_INPUT_RIGHT_PRIORITY = Number.MAX_SAFE_INTEGER;
		const ORBIT_INPUT_RIGHT_ORDER = Number.MAX_SAFE_INTEGER;
		/** Required client services: slots, the shared model directory, Remote (settings namespace), and locale. */
		const inject = [
			"slots",
			"modelDirectories",
			"remote",
			"remote.settings",
			"locale"
		];
		/**
		* Mount the Orbit model control over `ctx.modelDirectories` and the `orbit`
		* settings namespace.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-orbit: model control dictionaries");
			const settings = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({ status: "loading" });
			const adoptView = (view) => {
				const value = view.value;
				settings.set({
					status: "ready",
					commander: routeFromSettingsValue(value?.commander),
					watchdog: routeFromSettingsValue(value?.watchdog),
					revision: view.revision
				});
			};
			const reloadSettings = () => {
				(async () => {
					settings.update((draft) => {
						draft.status = "loading";
					});
					try {
						const response = await ctx.remote.settings.describe();
						if (!response.ok) {
							settings.update((draft) => {
								draft.status = "error";
								draft.error = response.error.message;
							});
							return;
						}
						const view = response.value.namespaces.find((entry) => entry.ns === ORBIT_SETTINGS_NS);
						if (view === void 0) {
							settings.update((draft) => {
								draft.status = "error";
								draft.error = `settings namespace "${ORBIT_SETTINGS_NS}" is not registered`;
							});
							return;
						}
						adoptView(view);
					} catch (error) {
						settings.update((draft) => {
							draft.status = "error";
							draft.error = error instanceof Error ? error.message : String(error);
						});
					}
				})();
			};
			ctx.effect(() => {
				reloadSettings();
				return ctx.remote.$on("settings/document-updated", () => {
					reloadSettings();
				});
			}, "dsh-orbit: settings mirror");
			const writeRole = async (role, route) => {
				const snapshot = settings.getSnapshot();
				if (snapshot.status !== "ready" || snapshot.revision === void 0) return false;
				try {
					const response = await ctx.remote.settings.update(ORBIT_SETTINGS_NS, { [role]: {
						provider: route.provider,
						model: route.model,
						reasoningEffort: route.reasoningEffort ?? ""
					} }, snapshot.revision);
					if (!response.ok) {
						settings.update((draft) => {
							draft.error = response.error.message;
						});
						reloadSettings();
						return false;
					}
					adoptView(response.value);
					return true;
				} catch (error) {
					settings.update((draft) => {
						draft.error = error instanceof Error ? error.message : String(error);
					});
					reloadSettings();
					return false;
				}
			};
			ctx.inject([
				"slots",
				"modelDirectories",
				"sessions"
			], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				const injected = (sessionId) => {
					const directory = models.directoryFor(sessionId);
					const available = sessions.subagentAddress(sessionId) === void 0;
					return {
						available,
						directory: directory.store,
						settings,
						loadModels: () => {
							if (available) directory.load().catch(() => {});
						},
						selectModel: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false),
						writeRole,
						setOrbitEnabled: async (enabled) => {
							const session = sessions.binding(sessionId)?.session;
							if (session === void 0) return false;
							try {
								const result = await session.command(`/orbit-toggle ${enabled ? "on" : "off"}`);
								return result.ok && result.value.matched;
							} catch {
								return false;
							}
						},
						reloadSettings
					};
				};
				scope.slots.inject("conversation.input.right", () => scope.slots.register({
					name: "conversation.input.right",
					id: "orbit-model",
					priority: ORBIT_INPUT_RIGHT_PRIORITY,
					order: ORBIT_INPUT_RIGHT_ORDER,
					locale: NS,
					inject: injected
				}, OrbitModelSelect));
			});
		}
		//#endregion
		exports.ORBIT_INPUT_RIGHT_ORDER = ORBIT_INPUT_RIGHT_ORDER;
		exports.ORBIT_INPUT_RIGHT_PRIORITY = ORBIT_INPUT_RIGHT_PRIORITY;
		exports.ORBIT_SETTINGS_NS = ORBIT_SETTINGS_NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
