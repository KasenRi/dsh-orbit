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
		/** Human effort label for a stored effort id; falls back to the raw id. */
		function effortLabelOf(model, effort) {
			if (effort === void 0 || effort === "") return void 0;
			return model?.reasoning?.efforts.find((entry) => entry.id === effort)?.name ?? effort;
		}
		/** Display name for a stored route: catalog name, then its model id. */
		function routeLabelOf(state, route) {
			if (route === void 0) return void 0;
			return modelOf(state, route)?.name ?? route.model;
		}
		/**
		* Route for a freshly picked model: the model's own default effort. A model
		* without effort metadata yields no effort — a previous model's effort is
		* never inherited.
		*/
		function routeForModel(provider, model) {
			const defaultEffort = model.reasoning?.defaultEffort;
			return {
				provider,
				model: model.id,
				...defaultEffort === void 0 ? {} : { reasoningEffort: defaultEffort }
			};
		}
		/**
		* Selection for the shared Session directory: preserve the current effort
		* when the route did not change, otherwise use the picked model's default.
		*/
		function selectionForModel(state, provider, model) {
			const effort = state.current?.provider === provider && state.current.model === model.id ? state.current?.reasoningEffort ?? model.reasoning?.defaultEffort : model.reasoning?.defaultEffort;
			return {
				provider,
				model: model.id,
				...effort === void 0 ? {} : { reasoningEffort: effort }
			};
		}
		/** Effort rows for one model; empty when the adapter publishes none. */
		function effortChoicesOf(model, providerDefaultLabel) {
			const reasoning = model?.reasoning;
			if (reasoning === void 0) return [];
			const choices = [];
			if (reasoning.defaultEffort !== void 0) choices.push({
				id: "provider-default",
				label: providerDefaultLabel,
				effort: void 0
			});
			for (const effort of reasoning.efforts) choices.push({
				id: `effort:${effort.id}`,
				label: effort.name,
				effort: effort.id
			});
			return choices;
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
		const css = ".f77nca_panel{z-index:60;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-menu);min-width:260px;max-width:420px;max-height:min(55vh,420px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);border-radius:12px;flex-direction:column;padding:6px;font-size:13px;line-height:1.4;display:flex;position:fixed;overflow:auto}.f77nca_title{color:var(--dsw-alias-label-tertiary);letter-spacing:.04em;text-transform:uppercase;padding:6px 8px 2px;font-size:11px}.f77nca_group{color:var(--dsw-alias-label-tertiary);padding:8px 8px 2px;font-size:11px}.f77nca_row{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:8px;align-items:center;gap:8px;padding:7px 8px;display:flex}.f77nca_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.f77nca_rowLabel{flex:none}.f77nca_rowValue{max-width:190px;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;margin-left:auto;overflow:hidden}.f77nca_rowValueActive{color:var(--dsw-alias-label-primary)}.f77nca_rowDetail{color:var(--dsw-alias-label-tertiary);margin-left:auto;font-size:11px}.f77nca_check{color:var(--dsw-alias-state-business-primary);flex:none;margin-left:6px}.f77nca_chevron{color:var(--dsw-alias-label-tertiary);flex:none;margin-left:6px}.f77nca_separator{background:var(--dsw-alias-border-l1);height:1px;margin:6px 4px}.f77nca_hint{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:11px}.f77nca_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:8px;padding:8px;font-size:12px;display:flex}.f77nca_back{width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:6px 8px 8px;font-size:12px;display:flex}";
		const tagId = "@kasenri/dsh-orbit/OrbitModelSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@kasenri/dsh-orbit";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var OrbitModelSelect_module_css_default = {
			"group": "f77nca_group",
			"error": "f77nca_error",
			"hint": "f77nca_hint",
			"rowValueActive": "f77nca_rowValueActive",
			"rowDetail": "f77nca_rowDetail",
			"panel": "f77nca_panel",
			"separator": "f77nca_separator",
			"check": "f77nca_check",
			"back": "f77nca_back",
			"rowLabel": "f77nca_rowLabel",
			"chevron": "f77nca_chevron",
			"row": "f77nca_row",
			"rowValue": "f77nca_rowValue",
			"title": "f77nca_title"
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
		/**
		* Render the Orbit model control.
		* @param props - injected directory/settings faces plus the locale seat.
		* @returns the trigger and, while open, the panel.
		*/
		function OrbitModelSelect({ t, available, directory, settings, loadModels, selectModel, writeRole, reloadSettings }) {
			const dir = (0, react.useSyncExternalStore)((listener) => directory.subscribe(listener), () => directory.getSnapshot());
			const config = (0, react.useSyncExternalStore)((listener) => settings.subscribe(listener), () => settings.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [pane, setPane] = (0, react.useState)({ kind: "root" });
			const [busy, setBusy] = (0, react.useState)(false);
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
				setBusy(true);
				const ok = await writeRole(role, route);
				setBusy(false);
				if (ok) setOpen(false);
			};
			const commitExecutor = async (selection) => {
				setBusy(true);
				const ok = await selectModel(selection);
				setBusy(false);
				if (ok) setOpen(false);
			};
			const currentRouteOf = (role) => role === "commander" ? config.commander : role === "watchdog" ? config.watchdog : executorRoute;
			const modelRow = (role, provider, providerName, model) => {
				const current = currentRouteOf(role);
				const active = current?.provider === provider && current.model === model.id;
				const reasoning = model.reasoning;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "menuitem",
					className: OrbitModelSelect_module_css_default.row,
					disabled: busy,
					onClick: () => {
						if (reasoning !== void 0 && reasoning.efforts.length > 0) {
							const effort = active ? current?.reasoningEffort ?? reasoning.defaultEffort : reasoning.defaultEffort;
							setPane({
								kind: "efforts",
								role,
								provider,
								modelId: model.id,
								effort
							});
							return;
						}
						if (role === "executor") {
							commitExecutor(selectionForModel(dir, provider, model));
							return;
						}
						commitRole(role, routeForModel(provider, model));
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
			const effortRow = (role, provider, modelId, id, label, effort, currentEffort) => {
				const healthy = pane.kind === "efforts" ? pane.effort : currentEffort;
				const active = id === "provider-default" ? healthy === void 0 : healthy === effort;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					role: "menuitem",
					className: OrbitModelSelect_module_css_default.row,
					disabled: busy,
					onClick: () => {
						if (role === "executor") {
							commitExecutor({
								provider,
								model: modelId,
								...effort === void 0 ? {} : { reasoningEffort: effort }
							});
							return;
						}
						commitRole(role, {
							provider,
							model: modelId,
							...effort === void 0 ? {} : { reasoningEffort: effort }
						});
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: OrbitModelSelect_module_css_default.rowLabel,
						children: label
					}), active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: OrbitModelSelect_module_css_default.check,
						children: "✓"
					}) : null]
				}, id);
			};
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
						commanderLabel,
						commanderEffort === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: { color: "var(--dsw-alias-label-tertiary)" },
							children: ` ${commanderEffort}`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: OrbitModelSelect_module_css_default.chevron,
							children: CARET
						})
					]
				})
			}), open && position !== null ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				className: OrbitModelSelect_module_css_default.panel,
				style: position,
				role: "menu",
				children: [
					pane.kind !== "root" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: OrbitModelSelect_module_css_default.back,
						onClick: () => {
							setPane({ kind: "root" });
						},
						children: `${BACK} ${t("back")}`
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.title,
						children: t("title")
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitem",
							className: OrbitModelSelect_module_css_default.row,
							disabled: busy,
							onClick: () => {
								setPane({
									kind: "models",
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
									kind: "models",
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
									kind: "models",
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
					pane.kind === "models" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: OrbitModelSelect_module_css_default.group,
							children: `${t(pane.role)} · ${t("models")}`
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
					pane.kind === "efforts" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.group,
						children: `${t(pane.role)} · ${t("effort")}`
					}), effortChoicesOf((() => {
						for (const group of dir.groups) {
							if (group.id !== pane.provider) continue;
							for (const model of group.models) if (model.id === pane.modelId) return model;
						}
					})(), t("providerDefault")).map((choice) => effortRow(pane.role, pane.provider, pane.modelId, choice.id, choice.label, choice.effort, pane.effort))] }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: OrbitModelSelect_module_css_default.separator }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: OrbitModelSelect_module_css_default.hint,
						children: t("nextRunOnly")
					})
				]
			}), document.body) : null] });
		}
		//#endregion
		//#region client/locales.ts
		const NS = "orbit-model";
		/** English strings (the key-set source of truth for this pair). */
		const en = {
			triggerFallback: "Orbit",
			tooltip: "Orbit model configuration",
			title: "Orbit",
			commander: "Commander",
			executor: "Executor",
			watchdog: "Watchdog",
			followsSession: "Follows current session model",
			models: "Models",
			effort: "Reasoning effort",
			providerDefault: "Provider default",
			back: "Back",
			retry: "Retry",
			loadFailed: "Failed to load models",
			settingsFailed: "Failed to load Orbit settings",
			saveFailed: "Failed to save Orbit settings",
			nextRunOnly: "Changes apply to the next Orbit run"
		};
		/** Chinese strings. */
		const zh = {
			triggerFallback: "Orbit",
			tooltip: "Orbit 模型配置",
			title: "Orbit",
			commander: "指挥官",
			executor: "执行员",
			watchdog: "监控模型",
			followsSession: "跟随当前会话模型",
			models: "模型",
			effort: "推理强度",
			providerDefault: "提供方默认",
			back: "返回",
			retry: "重试",
			loadFailed: "模型列表加载失败",
			settingsFailed: "Orbit 设置加载失败",
			saveFailed: "Orbit 设置保存失败",
			nextRunOnly: "更改应用于下一个新的 Orbit 运行"
		};
		//#endregion
		//#region client/index.ts
		/** The host settings namespace Orbit registers for its own two roles. */
		const ORBIT_SETTINGS_NS = "orbit";
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
						reloadSettings
					};
				};
				scope.slots.inject("conversation.input.right", () => scope.slots.register({
					name: "conversation.input.right",
					id: "orbit-model",
					order: 10,
					locale: NS,
					inject: injected
				}, OrbitModelSelect));
			});
		}
		//#endregion
		exports.ORBIT_SETTINGS_NS = ORBIT_SETTINGS_NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
